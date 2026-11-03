import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares, nnls

csv_path, ts_json_path = sys.argv[1:3]
with open(csv_path, newline="", encoding="utf-8-sig") as handle:
    rows = list(csv.reader(handle))
labels, headers = rows[0], rows[1]
series = []
for offset in range(0, len(headers), 3):
    label = labels[offset].strip()
    lower = label.lower()
    if "cmc" in lower:
        iron_type = "CMC-nZVI"
    elif "beijing" in lower:
        iron_type = "Beijing"
    elif "hepure" in lower:
        iron_type = "Hepure"
    elif "toda" in lower:
        iron_type = "Toda"
    elif "alfa" in lower:
        iron_type = "Alfa"
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
        "iron": iron_type,
        "observations": observations,
    })

# The 4L/4G table's 207/211 df counts imply this candidate set:
# all t>0 observations plus all seven CMC-nZVI t=0 observations.
fit_series = [
    {**s, "observations": [(t, y) for t, y in s["observations"] if t > 0 or s["iron"] == "CMC-nZVI"]}
    for s in series
]
types = list(dict.fromkeys(s["iron"] for s in fit_series))
if len(series) != 35 or sum(len(s["observations"]) for s in fit_series) != 287:
    raise RuntimeError("Expected 35 series and 287 candidate Model 4 observations.")

paper4l = {
    "Alfa": (0.4113, 0.0076), "Beijing": (0.1338, 0.0008),
    "Hepure": (0.4575, 0.0010), "Toda": (0.0358, 0.0054),
    "CMC-nZVI": (0.4838, 0.0117),
}
paper4g_k2 = {"Alfa": 0.0081, "Beijing": 0.0032, "Hepure": 0.0009, "Toda": 0.0170, "CMC-nZVI": 0.0114}

def solve_model(variant):
    if variant == "4L":
        x0 = np.log([v for iron in types for v in paper4l[iron]])
        lower = np.full(len(x0), math.log(1e-8))
        upper = np.full(len(x0), math.log(10.0))
        def decode(theta, iron):
            index = types.index(iron) * 2
            return math.exp(theta[index]), math.exp(theta[index + 1])
    else:
        x0 = np.log([0.4719] + [paper4g_k2[iron] for iron in types])
        lower = np.full(len(x0), math.log(1e-8))
        upper = np.full(len(x0), math.log(10.0))
        def decode(theta, iron):
            return math.exp(theta[0]), math.exp(theta[1 + types.index(iron)])

    def evaluate(theta, keep=False):
        residuals = []
        amplitudes = {}
        for s in fit_series:
            k1, k2 = decode(theta, s["iron"])
            t = np.array([p[0] for p in s["observations"]], dtype=float)
            y = np.array([p[1] for p in s["observations"]], dtype=float)
            design = np.column_stack((-np.expm1(-k1 * t), -np.expm1(-k2 * t)))
            amp, _ = nnls(design, y)
            residuals.extend(y - design @ amp)
            amplitudes[s["id"]] = {"A": float(amp[0]), "B": float(amp[1])}
        if keep:
            return np.asarray(residuals), amplitudes
        return np.asarray(residuals)

    result = least_squares(
        evaluate, x0, bounds=(lower, upper), method="trf",
        x_scale="jac", max_nfev=20000, ftol=1e-12, xtol=1e-12, gtol=1e-12,
    )
    residuals, amplitudes = evaluate(result.x, keep=True)
    dof = len(residuals) - (2 * len(fit_series) + (2 * len(types) if variant == "4L" else 1 + len(types)))
    rates = {}
    for iron in types:
        k1, k2 = decode(result.x, iron)
        rates[iron] = {"k1PerHour": k1, "k2PerHour": k2}
    return {
        "success": bool(result.success), "message": result.message, "nfev": int(result.nfev),
        "parameterCount": len(result.x) + 2 * len(fit_series),
        "degreesOfFreedom": dof, "sumSquaredResiduals": float(np.dot(residuals, residuals)),
        "reducedResidualStatistic": float(np.dot(residuals, residuals) / dof),
        "ratesByIronType": rates, "localAmplitudes": amplitudes,
    }

with open(ts_json_path, encoding="utf-8") as handle:
    ts = json.load(handle)["paperSeededFits"]
results = {}
for variant, ts_key, target in [
    ("4L", "model4L_unweighted", 1.6),
    ("4G", "model4G_unweighted", 3.8),
]:
    scipy_fit = solve_model(variant)
    ts_fit = ts[ts_key]
    if not scipy_fit["success"]:
        raise RuntimeError(variant + " independent SciPy optimizer did not converge.")
    if scipy_fit["degreesOfFreedom"] != ts_fit["degreesOfFreedom"]:
        raise RuntimeError(variant + " SciPy/TypeScript degrees of freedom differ.")
    if abs(scipy_fit["reducedResidualStatistic"] - ts_fit["reducedChiSquare"]) > 0.02:
        raise RuntimeError(variant + " SciPy/TypeScript reduced residual statistics differ.")
    for iron in ("Alfa", "Toda", "CMC-nZVI"):
        for key in ("k1PerHour", "k2PerHour"):
            a = scipy_fit["ratesByIronType"][iron][key]
            b = ts_fit["ratesByIronType"][iron][key]
            if abs(a - b) > max(1e-5, abs(b) * 0.03):
                raise RuntimeError(f"{variant} {iron} {key}: SciPy and TypeScript differ ({a} vs {b}).")
    for parameter in ("A", "B"):
        a = scipy_fit["localAmplitudes"]["35"][parameter]
        b = ts_fit["localAmplitudes"]["35"][parameter]
        if abs(a - b) > 0.02:
            raise RuntimeError(f"{variant} Alfa blank {parameter}: SciPy and TypeScript differ ({a} vs {b}).")
    if abs(scipy_fit["reducedResidualStatistic"] - target) > (0.15 if variant == "4L" else 0.2):
        raise RuntimeError(variant + " does not reproduce the paper's published statistic.")
    results[variant] = {
        "scipy": {k: v for k, v in scipy_fit.items() if k != "localAmplitudes"},
        "typescriptReducedStatistic": ts_fit["reducedChiSquare"],
        "publishedReducedStatistic": target,
    }

print(json.dumps({"independentSciPyQinModel4": results}, indent=2))
