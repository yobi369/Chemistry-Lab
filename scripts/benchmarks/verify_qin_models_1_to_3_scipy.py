import csv
import json
import math
import sys

import numpy as np
from scipy.optimize import least_squares

csv_path, ts_json_path = sys.argv[1:3]
with open(csv_path, newline="", encoding="utf-8-sig") as handle:
    rows = list(csv.reader(handle))
labels, headers = rows[0], rows[1]
series = []
for offset in range(0, len(headers), 3):
    label = labels[offset].strip()
    lower = label.lower()
    iron = "CMC-nZVI" if "cmc" in lower else (
        "Beijing" if "beijing" in lower else "Hepure" if "hepure" in lower else
        "Toda" if "toda" in lower else "Alfa" if "alfa" in lower else None
    )
    if iron is None:
        raise RuntimeError("Unknown iron type: " + label)
    observations = []
    for row in rows[2:]:
        cells = row[offset:offset + 3]
        if not cells or all(not x.strip() for x in cells):
            continue
        if len(cells) != 3 or any(not x.strip() for x in cells):
            raise RuntimeError("Partial triplet in " + label)
        observations.append((float(cells[0]), float(cells[1])))
    series.append({"id": label.split(" ")[0].lstrip("#"), "label": label, "iron": iron, "observations": observations})

# The supporting-information Tables S2–S4 contain 31 fitted conditions:
# the four additional CMC-nZVI dithionite/thiosulfate conditions are not in
# those tables. All nine time points are retained for the 31 conditions.
excluded = {"64", "65", "68", "69"}
series = [s for s in series if s["id"] not in excluded]
types = list(dict.fromkeys(s["iron"] for s in series))
if len(series) != 31 or sum(len(s["observations"]) for s in series) != 279:
    raise RuntimeError("Expected 31 series and 279 points for Models 1–3.")

paper = {
    "1": {"rates": {"Alfa": (0.0235, 0.008), "Beijing": (0.0093, 0.008), "Hepure": (0.0054, 0.008), "Toda": (0.0223, 0.008), "CMC-nZVI": (0.1367, 0.008)}},
    "2": {"rates": {"Alfa": (0.2072, 0.008), "Beijing": (0.1242, 0.008), "Hepure": (0.3226, 0.008), "Toda": (0.0297, 0.008), "CMC-nZVI": (0.3489, 0.008)},
         "ratios": {"Alfa": 11.7471, "Beijing": 4.0321, "Hepure": 4.8621, "Toda": 12.8096, "CMC-nZVI": 48.8760}},
    "3": {"rates": {"Alfa": (0.4000, 0.0074), "Beijing": (0.1234, 0.0002), "Hepure": (0.3383, 0.0002), "Toda": (0.0628, 0.0151), "CMC-nZVI": (0.4810, 0.0115)},
         "ratios": {"Alfa": 9.4411, "Beijing": 4.0006, "Hepure": 4.8845, "Toda": 1.8642, "CMC-nZVI": 27.8439}},
}

def run_model(model):
    keys = []
    initial = []
    lower = []
    upper = []
    for iron in types:
        k1, k2 = paper[model]["rates"][iron]
        if model == "1":
            keys.append((iron, "k1")); initial.append(math.log(k1)); lower.append(math.log(1e-8)); upper.append(math.log(10))
        elif model == "2":
            keys.extend([(iron, "k1"), (iron, "ratio")])
            initial.extend([math.log(k1), math.log(paper[model]["ratios"][iron])])
            lower.extend([math.log(1e-8), math.log(1e-8)])
            upper.extend([math.log(10), math.log(1e5)])
        else:
            keys.extend([(iron, "k1"), (iron, "gap"), (iron, "ratio")])
            initial.extend([math.log(k1), math.log(k1 / k2), math.log(paper[model]["ratios"][iron])])
            lower.extend([math.log(1e-8), math.log(1e-5), math.log(1e-8)])
            upper.extend([math.log(10), math.log(1e5), math.log(1e5)])

    def decode(theta, iron):
        values = {name: math.exp(theta[i]) for i, (group, name) in enumerate(keys) if group == iron}
        k1 = values["k1"]
        if model == "1":
            return {"k1": k1, "k2": 0.0, "ratio": 1.0}
        if model == "2":
            return {"k1": k1, "k2": 0.0, "ratio": values["ratio"]}
        return {"k1": k1, "k2": k1 / values["gap"], "ratio": values["ratio"]}

    def basis(t, p):
        e1 = -math.expm1(-p["k1"] * t)
        if model == "1":
            return e1
        if model == "2":
            return t + (p["ratio"] - 1.0) * e1 / p["k1"]
        e2 = -math.expm1(-p["k2"] * t)
        if abs(p["k2"] - p["k1"]) <= 1e-7 * max(p["k1"], p["k2"]):
            phase2 = (1 - math.exp(-p["k1"] * t) * (1 + p["k1"] * t)) / p["k1"]
        else:
            phase2 = p["k1"] / (p["k2"] - p["k1"]) * (e1 / p["k1"] - e2 / p["k2"])
        return p["ratio"] * e1 / p["k1"] + phase2

    def evaluate(theta, keep=False):
        residuals = []
        local = {}
        for s in series:
            p = decode(theta, s["iron"])
            t = np.array([x[0] for x in s["observations"]], dtype=float)
            y = np.array([x[1] for x in s["observations"]], dtype=float)
            x = np.array([basis(float(time), p) for time in t])
            scale = max(0.0, float(np.dot(x, y) / np.dot(x, x))) if np.dot(x, x) > 0 else 0.0
            residuals.extend(y - scale * x)
            local[s["id"]] = scale
        if keep:
            return np.asarray(residuals), local
        return np.asarray(residuals)

    result = least_squares(
        evaluate, np.asarray(initial), bounds=(np.asarray(lower), np.asarray(upper)),
        method="trf", x_scale="jac", max_nfev=20000,
        ftol=1e-12, xtol=1e-12, gtol=1e-12,
    )
    residuals, local = evaluate(result.x, keep=True)
    parameters = {}
    for iron in types:
        p = decode(result.x, iron)
        parameters[iron] = {"k1PerHour": p["k1"]}
        if model == "2":
            parameters[iron]["ratio"] = p["ratio"]
        elif model == "3":
            parameters[iron]["k2PerHour"] = p["k2"]
            parameters[iron]["ratio"] = p["ratio"]
    parameter_count = len(result.x) + len(series)
    dof = len(residuals) - parameter_count
    sse = float(np.dot(residuals, residuals))
    return {
        "success": bool(result.success), "nfev": int(result.nfev),
        "parameterCount": parameter_count, "degreesOfFreedom": dof,
        "sumSquaredResiduals": sse, "reducedResidualStatistic": sse / dof,
        "globalParameters": parameters, "localScaleParameters": local,
    }

with open(ts_json_path, encoding="utf-8") as handle:
    ts = json.load(handle)
results = {}
for model, key, target, dof in [
    ("1", "model1", 45.0, 243),
    ("2", "model2", 7.2, 238),
    ("3", "model3", 5.3, 233),
]:
    scipy_fit = run_model(model)
    ts_fit = ts[key]
    if not scipy_fit["success"] or scipy_fit["degreesOfFreedom"] != dof:
        raise RuntimeError("SciPy Model " + model + " did not converge with expected df.")
    if abs(scipy_fit["reducedResidualStatistic"] - ts_fit["reducedChiSquare"]) > 0.02:
        raise RuntimeError("SciPy and TypeScript Model " + model + " statistics differ.")
    if abs(scipy_fit["localScaleParameters"]["35"] - ts_fit["alfaBlankLocalScale"]) > 0.01:
        raise RuntimeError("SciPy and TypeScript Model " + model + " Alfa blank scale differs.")
    # Alfa and CMC-nZVI are well-constrained reference groups for these models.
    for iron in ("Alfa", "CMC-nZVI"):
        for name, value in scipy_fit["globalParameters"][iron].items():
            ts_value = ts_fit["globalParameters"][iron][name]
            if abs(value - ts_value) > max(1e-5, abs(ts_value) * 0.03):
                raise RuntimeError(f"Model {model} {iron} {name}: SciPy and TypeScript differ.")
    results[model] = {
        "scipy": {k: v for k, v in scipy_fit.items() if k != "localScaleParameters"},
        "typescriptReducedStatistic": ts_fit["reducedChiSquare"],
        "publishedReducedStatistic": target,
    }

print(json.dumps({"independentSciPyQinModels1to3": results}, indent=2))
