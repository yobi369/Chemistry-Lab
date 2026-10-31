#!/usr/bin/env python3
"""Recompute independent SciPy reference fixtures and check conservation/positivity."""
import json
from pathlib import Path
import sys

import numpy as np
import scipy
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((ROOT / "benchmarks/scientific-reference-fixtures.json").read_text())
if scipy.__version__ != FIXTURE["generatedWith"]["scipy"]:
    raise SystemExit(f"Expected SciPy {FIXTURE['generatedWith']['scipy']}, got {scipy.__version__}")

def verify_case(name, rhs, initial, rtol, atol):
    case = FIXTURE[name]
    times = np.asarray(case["timesSeconds"], dtype=float)
    outputs = {}
    for method, fixture_key in (("BDF", "referenceByBDF"), ("Radau", "referenceByRadau")):
        result = solve_ivp(rhs, (0.0, float(times[-1])), initial, method=method,
                           t_eval=times, rtol=rtol, atol=atol)
        if not result.success:
            raise SystemExit(f"{name}/{method} failed: {result.message}")
        computed = result.y.T
        reference = np.asarray(case[fixture_key], dtype=float)
        if not np.allclose(computed, reference, rtol=2e-7, atol=2e-12):
            error = float(np.max(np.abs(computed-reference)))
            raise SystemExit(f"{name}/{method} differs from frozen reference; max abs error={error}")
        if np.min(computed) < -2e-12:
            raise SystemExit(f"{name}/{method} violated non-negativity")
        if not np.allclose(np.sum(computed, axis=1), 1.0, rtol=0, atol=2e-9):
            raise SystemExit(f"{name}/{method} violated total concentration conservation")
        outputs[method] = computed
        print(f"PASS {name}/{method}: nfev={result.nfev}, njev={result.njev}, nlu={result.nlu}")
    if not np.allclose(outputs["BDF"], outputs["Radau"], rtol=2e-7, atol=2e-12):
        raise SystemExit(f"{name}: independent BDF and Radau solutions disagree")
    print(f"PASS {name}: BDF/Radau agreement, positivity and conservation")

def main():
    verify_case("sequentialAtoBtoC",
        lambda t,y: [-0.7*y[0], 0.7*y[0]-0.25*y[1], 0.25*y[1]],
        [1.0,0.0,0.0], 1e-12, 1e-14)
    verify_case("robertson1966",
        lambda t,y: [-0.04*y[0]+1e4*y[1]*y[2],
                     0.04*y[0]-1e4*y[1]*y[2]-3e7*y[1]**2,
                     3e7*y[1]**2],
        [1.0,0.0,0.0], 1e-11, [1e-14,1e-18,1e-14])

if __name__ == "__main__":
    main()
