#!/usr/bin/env python3
"""Independent SciPy BDF reference fit for the stiff sequential kinetic fixture."""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

if scipy.__version__ != "1.17.0":
    raise SystemExit(f"Expected SciPy 1.17.0, got {scipy.__version__}")

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "scripts/benchmarks/fixtures/stiff-sequential-kinetic-fit.json"


def main():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    times = np.asarray(fixture["times_seconds"], dtype=float)
    observed = np.asarray(fixture["observed_concentrations"], dtype=float)
    sd = float(fixture["standard_deviation"])
    lower = np.asarray(fixture["parameter_bounds"]["lower"], dtype=float)
    upper = np.asarray(fixture["parameter_bounds"]["upper"], dtype=float)

    def rhs(_time, state, k1, k2):
        a, b, _c = state
        return [-k1 * a, k1 * a - k2 * b, k2 * b]

    def predict(theta):
        solution = solve_ivp(
            lambda time, state: rhs(time, state, *theta),
            (0.0, float(times[-1])),
            fixture["initial_concentrations"].values(),
            method="BDF",
            t_eval=times,
            rtol=1e-10,
            atol=1e-12,
        )
        if not solution.success or solution.y.shape != (3, len(times)):
            raise RuntimeError("SciPy BDF failed: " + solution.message)
        return solution.y.T

    def residual(theta):
        return ((predict(theta) - observed) / sd).ravel()

    fit = least_squares(
        residual,
        fixture["typescript_fit"]["initial_guess"],
        bounds=(lower, upper),
        method="trf",
        x_scale="jac",
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-12,
        max_nfev=1000,
    )
    if not fit.success or not np.all(np.isfinite(fit.x)):
        raise RuntimeError("SciPy BDF least-squares fit failed: " + fit.message)
    reference = fixture["scipy_reference"]
    if not np.allclose(fit.x, [reference["parameters"]["k1"], reference["parameters"]["k2"]],
                       rtol=0, atol=reference["parameter_tolerance"]):
        raise RuntimeError("SciPy BDF fit differs from pinned reference parameters.")
    weighted_rss = float(np.dot(fit.fun, fit.fun))
    if abs(weighted_rss - reference["weighted_residual_sum_squares"]) > reference["weighted_rss_tolerance"]:
        raise RuntimeError("SciPy BDF weighted residual sum of squares differs from pinned reference.")
    print(json.dumps({
        "method": "SciPy 1.17.0 solve_ivp BDF + bounded least_squares",
        "parameters": {"k1": float(fit.x[0]), "k2": float(fit.x[1])},
        "weightedResidualSumSquares": weighted_rss,
        "evaluations": int(fit.nfev),
        "success": bool(fit.success),
    }, indent=2))


if __name__ == "__main__":
    main()
