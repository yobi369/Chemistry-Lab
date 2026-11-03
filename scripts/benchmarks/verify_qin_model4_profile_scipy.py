#!/usr/bin/env python3
"""Independent SciPy verification of Qin Model 4 conditional profile objectives.

This deliberately does not import or call the TypeScript fitter. Each local
(A, B) pair is solved by SciPy NNLS, while shared rates are optimized with
scipy.optimize.least_squares. It consumes the TypeScript profile JSON only
as the set of rate coordinates and comparison target.
"""
import csv
import json
import math
import sys

import numpy as np
from scipy.optimize import least_squares, nnls

if len(sys.argv) != 3:
    raise SystemExit(
        "Usage: verify_qin_model4_profile_scipy.py <qin-csv> <typescript-profile-json>"
    )
csv_path, ts_profile_path = sys.argv[1:3]

with open(csv_path, newline="", encoding="utf-8-sig") as handle:
    rows = list(csv.reader(handle))
labels, headers = rows[0], rows[1]
series = []
for offset in range(0, len(headers), 3):
    label = labels[offset].strip()
    lower = label.lower()
    if "cmc" in lower:
        iron = "CMC-nZVI"
    elif "beijing" in lower:
        iron = "Beijing"
    elif "hepure" in lower:
        iron = "Hepure"
    elif "toda" in lower:
        iron = "Toda"
    elif "alfa" in lower:
        iron = "Alfa"
    else:
        raise RuntimeError("Unknown iron type in label: " + label)
    observations = []
    for row in rows[2:]:
        cells = row[offset:offset + 3]
        if not cells or all(not cell.strip() for cell in cells):
            continue
        if len(cells) != 3 or any(not cell.strip() for cell in cells):
            raise RuntimeError("Partial data triplet for " + label)
        observations.append((float(cells[0]), float(cells[1])))
    series.append({
        "id": label.split(" ")[0].lstrip("#"),
        "label": label,
        "iron": iron,
        "observations": observations,
    })

excluded = {"64", "65", "68", "69"}
fit_series = [s for s in series if s["id"] not in excluded]
types = list(dict.fromkeys(s["iron"] for s in fit_series))
if len(series) != 35 or len(fit_series) != 31 or sum(
    len(s["observations"]) for s in fit_series
) != 279:
    raise RuntimeError("Expected 31 published Model 4 conditions / 279 observations.")

initial_4l = {
    "Alfa": (0.4113, 0.0076),
    "Beijing": (0.1338, 0.0008),
    "Hepure": (0.4575, 0.0010),
    "Toda": (0.0358, 0.0054),
    "CMC-nZVI": (0.4838, 0.0117),
}
initial_4g_k2 = {
    "Alfa": 0.0081, "Beijing": 0.0032, "Hepure": 0.0009,
    "Toda": 0.0170, "CMC-nZVI": 0.0114,
}
LOWER, UPPER = math.log(1e-8), math.log(10.0)
CUTOFF = 3.841458820694124
MAX_RELATIVE_SSE_DIFFERENCE = 5e-4
MAX_RELATIVE_INTERVAL_DIFFERENCE = 2e-2


def parameter_layout(model):
    if model == "4L":
        keys = [(iron, phase) for iron in types for phase in ("k1", "k2")]
        initial = [math.log(value) for iron in types for value in initial_4l[iron]]
    elif model == "4G":
        keys = [("GLOBAL", "k1")] + [(iron, "k2") for iron in types]
        initial = [math.log(0.4719)] + [math.log(initial_4g_k2[iron]) for iron in types]
    else:
        raise RuntimeError("Unknown model: " + model)
    return keys, np.asarray(initial, dtype=float)


def profile_fit(model, fixed_key=None, fixed_rate=None, start=None):
    keys, default_initial = parameter_layout(model)
    initial = np.asarray(default_initial if start is None else start, dtype=float).copy()
    fixed_index = keys.index(fixed_key) if fixed_key is not None else None
    if fixed_index is not None:
        initial[fixed_index] = math.log(fixed_rate)
        free_indices = np.asarray([i for i in range(len(keys)) if i != fixed_index], dtype=int)
    else:
        free_indices = np.arange(len(keys), dtype=int)

    def decoded(theta):
        rates = np.exp(theta)
        if fixed_index is not None:
            rates[fixed_index] = fixed_rate
        return rates

    def residual_vector(free_theta, keep=False):
        theta = initial.copy()
        theta[free_indices] = free_theta
        rates = decoded(theta)
        residuals = []
        for item in fit_series:
            if model == "4L":
                k1 = rates[keys.index((item["iron"], "k1"))]
            else:
                k1 = rates[keys.index(("GLOBAL", "k1"))]
            k2 = rates[keys.index((item["iron"], "k2"))]
            t = np.asarray([p[0] for p in item["observations"]], dtype=float)
            y = np.asarray([p[1] for p in item["observations"]], dtype=float)
            design = np.column_stack((-np.expm1(-k1 * t), -np.expm1(-k2 * t)))
            amplitudes, _ = nnls(design, y)
            residuals.extend(y - design @ amplitudes)
        values = np.asarray(residuals, dtype=float)
        return (values, rates, theta) if keep else values

    result = least_squares(
        residual_vector,
        initial[free_indices],
        bounds=(np.full(len(free_indices), LOWER), np.full(len(free_indices), UPPER)),
        method="trf",
        x_scale="jac",
        max_nfev=30000,
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-12,
    )
    residuals, rates, theta = residual_vector(result.x, keep=True)
    if not result.success or not np.all(np.isfinite(residuals)):
        raise RuntimeError(
            f"SciPy conditional refit failed for {model} {fixed_key}={fixed_rate}: "
            f"{result.message}"
        )
    return {
        "objective": float(np.dot(residuals, residuals)),
        "rates": rates,
        "theta": theta,
        "nfev": int(result.nfev),
    }


def profile_fit_multistart(model, fixed_key, fixed_rate, warm, baseline):
    # Independent deterministic starts: continuation, baseline, and perturbed
    # log-rate vectors. Select the best valid conditional objective.
    seeds = [np.asarray(warm, dtype=float), baseline["theta"]]
    for factor in (0.1, 10.0, 0.03, 3.0, 0.3):
        for direction in (1.0, -1.0):
            signs = np.where(np.arange(len(baseline["theta"])) % 2 == 0, 1.0, -1.0)
            seeds.append(np.clip(
                baseline["theta"] + direction * math.log(factor) * signs,
                LOWER, UPPER,
            ))
    candidates = [
        profile_fit(model, fixed_key, fixed_rate, start=seed)
        for seed in seeds
    ]
    return min(candidates, key=lambda item: item["objective"])

def baseline_fit_multistart(model):
    # The unconstrained starting fit can itself be trapped in a local basin.
    # Search the same bounded log-rate space independently before using it as
    # the likelihood-ratio denominator.
    _, initial = parameter_layout(model)
    seeds = [initial]
    signs = np.where(np.arange(len(initial)) % 2 == 0, 1.0, -1.0)
    for factor in (0.1, 10.0, 0.03, 3.0, 0.3):
        for direction in (1.0, -1.0):
            seeds.append(np.clip(
                initial + direction * math.log(factor) * signs, LOWER, UPPER
            ))
    candidates = [profile_fit(model, start=seed) for seed in seeds]
    return min(candidates, key=lambda item: item["objective"])


def likelihood_statistic(objective, minimum, n):
    if objective <= 0 or minimum <= 0:
        return None
    return max(0.0, n * math.log(objective / minimum))


def connected_components(points, minimum, n):
    accepted = []
    for point in points:
        statistic = likelihood_statistic(point["objective"], minimum, n)
        accepted.append(
            statistic is not None and statistic <= CUTOFF
        )
    components = []
    current = []
    for point, is_accepted in zip(points, accepted):
        if is_accepted:
            current.append(point)
        elif current:
            components.append(current)
            current = []
    if current:
        components.append(current)
    return components


def refine_endpoint(model, fixed_key, outside, inside, side, minimum, n, start, baseline):
    lo = math.log(min(outside, inside))
    hi = math.log(max(outside, inside))
    for _ in range(24):
        midpoint = (lo + hi) / 2
        rate = math.exp(midpoint)
        fit = profile_fit_multistart(model, fixed_key, rate, start, baseline)
        statistic = likelihood_statistic(fit["objective"], minimum, n)
        accepted = statistic is not None and statistic <= CUTOFF
        if side == "lower":
            if accepted:
                hi = midpoint
            else:
                lo = midpoint
        else:
            if accepted:
                lo = midpoint
            else:
                hi = midpoint
    return math.exp((lo + hi) / 2)


def interval_for_component(model, fixed_key, component, all_points, minimum, n, start, baseline):
    first, last = component[0], component[-1]
    first_index = all_points.index(first)
    last_index = all_points.index(last)
    lower_limited = first_index == 0
    upper_limited = last_index == len(all_points) - 1
    lower = first["ratePerHour"] if lower_limited else refine_endpoint(
        model, fixed_key, all_points[first_index - 1]["ratePerHour"],
        first["ratePerHour"], "lower", minimum, n, start, baseline,
    )
    upper = last["ratePerHour"] if upper_limited else refine_endpoint(
        model, fixed_key, all_points[last_index + 1]["ratePerHour"],
        last["ratePerHour"], "upper", minimum, n, start, baseline,
    )
    return {
        "lowerPerHour": lower,
        "upperPerHour": upper,
        "boundaryLimited": {"lower": lower_limited, "upper": upper_limited},
    }


with open(ts_profile_path, encoding="utf-8") as handle:
    ts_report = json.load(handle)

verified = []
for ts_result in ts_report["results"]:
    model = ts_result["model"]
    parameter = ts_result["parameter"]
    group, parameter_name = parameter.split(".")
    fixed_key = (group, "k1" if parameter_name == "k1PerHour" else "k2")
    baseline = baseline_fit_multistart(model)
    ts_points = ts_result["points"]
    scipy_points = []
    warm_start = baseline["theta"]

    for ts_point in ts_points:
        rate = float(ts_point["ratePerHour"])
        fit = profile_fit_multistart(model, fixed_key, rate, warm_start, baseline)
        warm_start = fit["theta"]
        scipy_points.append({
            "ratePerHour": rate,
            "objective": fit["objective"],
            "converged": True,
            "nfev": fit["nfev"],
        })

    n = int(ts_result["observationCount"])
    minimum = min(
        [baseline["objective"]] + [p["objective"] for p in scipy_points]
    )
    if minimum < baseline["objective"] - 1e-8 * (1 + baseline["objective"]):
        raise RuntimeError(
            f"{model} {parameter}: SciPy profile grid improved the unconstrained "
            "baseline; refine baseline before interpreting intervals."
        )

    relative_differences = []
    for ts_point, scipy_point in zip(ts_points, scipy_points):
        relative_differences.append(
            abs(ts_point["objective"] - scipy_point["objective"])
            / max(ts_point["objective"], scipy_point["objective"], 1e-12)
        )
    max_relative_sse_difference = max(relative_differences, default=0.0)
    if max_relative_sse_difference > MAX_RELATIVE_SSE_DIFFERENCE:
        raise RuntimeError(
            f"{model} {parameter}: independent SciPy profile SSE mismatch "
            f"{max_relative_sse_difference:.3g} exceeds "
            f"{MAX_RELATIVE_SSE_DIFFERENCE:.3g}; "
            f"TypeScript baseline={ts_result['baselineObjective']:.12g}, "
            f"SciPy baseline={baseline['objective']:.12g}, "
            f"worst grid TypeScript={max(ts_points, key=lambda p: abs(p['objective'] - scipy_points[ts_points.index(p)]['objective']))['objective']:.12g}, "
            f"SciPy={scipy_points[max(range(len(ts_points)), key=lambda i: abs(ts_points[i]['objective'] - scipy_points[i]['objective']))]['objective']:.12g}."
        )

    components = connected_components(scipy_points, minimum, n)
    scipy_intervals = [
        interval_for_component(
            model, fixed_key, component, scipy_points, minimum, n, baseline["theta"], baseline
        )
        for component in components
    ]
    ts_intervals = []
    primary = ts_result.get("interval95GridApproximation")
    if primary is not None:
        ts_intervals.append(primary)
    ts_intervals.extend(ts_result.get("additionalAcceptedComponents", []))
    if len(ts_intervals) != len(scipy_intervals):
        raise RuntimeError(
            f"{model} {parameter}: TypeScript/SciPy accepted-component count differs "
            f"({len(ts_intervals)} vs {len(scipy_intervals)})."
        )
    interval_differences = []
    for ts_interval, scipy_interval in zip(ts_intervals, scipy_intervals):
        for edge in ("lowerPerHour", "upperPerHour"):
            a = float(ts_interval[edge])
            b = float(scipy_interval[edge])
            interval_differences.append(abs(a - b) / max(abs(a), abs(b), 1e-12))
        if ts_interval["boundaryLimited"] != scipy_interval["boundaryLimited"]:
            raise RuntimeError(
                f"{model} {parameter}: boundary-limited classification differs."
            )
    max_relative_interval_difference = max(interval_differences, default=0.0)
    if max_relative_interval_difference > MAX_RELATIVE_INTERVAL_DIFFERENCE:
        raise RuntimeError(
            f"{model} {parameter}: TypeScript/SciPy interval mismatch "
            f"{max_relative_interval_difference:.3g} exceeds "
            f"{MAX_RELATIVE_INTERVAL_DIFFERENCE:.3g}."
        )

    verified.append({
        "model": model,
        "parameter": parameter,
        "observationCount": n,
        "scipyBaselineObjective": baseline["objective"],
        "typescriptBaselineObjective": ts_result["baselineObjective"],
        "scipyProfileMinimumObjective": minimum,
        "typescriptProfileMinimumObjective": ts_result["profileMinimumObjective"],
        "profileGridPointCount": len(scipy_points),
        "maxRelativeProfileSseDifference": max_relative_sse_difference,
        "typescriptAcceptedIntervals": ts_intervals,
        "scipyAcceptedIntervals": scipy_intervals,
        "maxRelativeIntervalDifference": max_relative_interval_difference,
        "scipyProfilePoints": scipy_points,
    })

print(json.dumps({
    "independentSciPyProfileLikelihoodVerification": {
        "method": "Independent variable-projection fit: SciPy NNLS for local amplitudes and SciPy least_squares for shared log-rates; no TypeScript fitter imported.",
        "sourceSelection": "31 Model 4 table conditions, 279 observations; exclude raw CMC-nZVI series #64, #65, #68, #69.",
        "likelihoodRatioConvention": "n * ln(SSE_profile / SSE_min) <= chi-square(1, 0.95) = 3.841458820694124.",
        "tolerances": {
            "maximumRelativeProfileSseDifference": MAX_RELATIVE_SSE_DIFFERENCE,
            "maximumRelativeIntervalDifference": MAX_RELATIVE_INTERVAL_DIFFERENCE,
        },
        "verifiedProfiles": verified,
    }
}, indent=2))
