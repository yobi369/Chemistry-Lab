#!/usr/bin/env python3
"""SciPy reference fit for the shared TypeScript/Python kinetic parity fixture."""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import least_squares

if scipy.__version__ != "1.17.0":
    raise SystemExit(f"Expected SciPy 1.17.0, got {scipy.__version__}")

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "scripts/benchmarks/fixtures/sequential-kinetic-fit.json"


def load_fixture():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if fixture.get("schema_version") != 1:
        raise SystemExit("Unsupported kinetic parity fixture schema")
    return fixture


def main():
    fixture = load_fixture()
    times = np.asarray(fixture["times_seconds"], dtype=float)
    observed = np.asarray(fixture["observed_concentrations"], dtype=float)
    sd = float(fixture["standard_deviation"])
    true = np.array([fixture["true_parameters"]["k1"], fixture["true_parameters"]["k2"]])
    lower = np.asarray(fixture["parameter_bounds"]["lower"], dtype=float)
    upper = np.asarray(fixture["parameter_bounds"]["upper"], dtype=float)

    if observed.shape != (len(times), 3) or not np.all(np.isfinite(observed)):
        raise SystemExit("Fixture observations must be a finite time-by-three-species matrix")
    if sd <= 0 or not np.isfinite(sd):
        raise SystemExit("Fixture standard deviation must be finite and positive")

    def predict(theta):
        k1, k2 = theta
        a = np.exp(-k1 * times)
        if abs(k2-k1) < 1e-10:
            b = k1 * times * np.exp(-k1 * times)
        else:
            b = k1 / (k2-k1) * (np.exp(-k1*times)-np.exp(-k2*times))
        return np.stack([a, b, 1.0-a-b], axis=1)

    def residual(theta):
        return ((predict(theta)-observed)/sd).ravel()

    solutions = []
    costs = []
    for start in fixture["initial_guesses"]:
        result = least_squares(
            residual, start, bounds=(lower, upper), method="trf", x_scale="jac",
            ftol=1e-12, xtol=1e-12, gtol=1e-12, max_nfev=2000,
        )
        if not result.success or not np.all(np.isfinite(result.x)):
            raise SystemExit(f"fit failed from {start}: {result.message}")
        solutions.append(result.x)
        costs.append(2*result.cost)
        print(f"PASS SciPy start={start}: k1={result.x[0]:.8f}, "
              f"k2={result.x[1]:.8f}, weighted_RSS={2*result.cost:.9f}")

    solutions = np.asarray(solutions)
    costs = np.asarray(costs)
    if not np.allclose(solutions, solutions[0], rtol=2e-5, atol=2e-6):
        raise SystemExit(f"initialization-dependent solutions: {solutions}")
    reference = fixture["scipy_reference"]
    expected = np.array([reference["parameters"]["k1"], reference["parameters"]["k2"]])
    if not np.allclose(solutions[0], expected, atol=2e-7, rtol=0):
        raise SystemExit(f"SciPy result differs from pinned fixture reference: {solutions[0]}")
    if not np.allclose(solutions[0], true, atol=reference["parameter_tolerance"], rtol=0):
        raise SystemExit(f"fit did not recover generating parameters: {solutions[0]}")
    if abs(costs[0]-reference["weighted_residual_sum_squares"]) > 1e-6:
        raise SystemExit(f"SciPy weighted RSS changed unexpectedly: {costs[0]}")
    print("PASS shared fixture: SciPy bounded fit and four-start stability")


if __name__ == "__main__":
    main()
