#!/usr/bin/env python3
"""Independent SciPy BDF/Radau references and nonlinear fit for a stiff reversible network."""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

if scipy.__version__ != "1.17.0":
    raise SystemExit(f"Expected SciPy 1.17.0, got {scipy.__version__}")

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "scripts/benchmarks/fixtures/stiff-reversible-slow-drain-fit.json"


def main():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    times = np.asarray(fixture["times_seconds"], dtype=float)
    expected_bdf = np.asarray(fixture["reference_by_BDF"], dtype=float)
    expected_radau = np.asarray(fixture["reference_by_Radau"], dtype=float)
    observed = np.asarray(fixture["observed_concentrations"], dtype=float)
    sd = float(fixture["standard_deviation"])

    def rhs(_time, state, forward, reverse, drain):
        a, b, _c = state
        return [-forward * a + reverse * b,
                forward * a - (reverse + drain) * b,
                drain * b]

    def simulate(method, parameters, rtol=1e-11, atol=1e-13):
        solution = solve_ivp(
            lambda time, state: rhs(time, state, *parameters),
            (0.0, float(times[-1])),
            [fixture["initial_concentrations"][species] for species in fixture["species_ids"]],
            method=method,
            t_eval=times,
            rtol=rtol,
            atol=atol,
        )
        if not solution.success or solution.y.shape != (3, len(times)):
            raise RuntimeError(f"SciPy {method} failed: {solution.message}")
        return solution.y.T

    truth = [fixture["true_parameters"][key] for key in ("forward", "reverse", "drain")]
    bdf = simulate("BDF", truth)
    radau = simulate("Radau", truth)
    if not np.allclose(bdf, expected_bdf, rtol=0, atol=2e-9):
        raise RuntimeError("Recomputed SciPy BDF trajectory differs from the pinned fixture.")
    if not np.allclose(radau, expected_radau, rtol=0, atol=2e-9):
        raise RuntimeError("Recomputed SciPy Radau trajectory differs from the pinned fixture.")
    if not np.allclose(bdf, radau, rtol=0, atol=2e-9):
        raise RuntimeError("Independent SciPy BDF and Radau trajectories disagree.")
    if not np.allclose(bdf, observed, rtol=0, atol=2e-12):
        raise RuntimeError("Observation fixture is not the pinned BDF reference.")
    if not np.allclose(np.sum(bdf, axis=1), 1.0, rtol=0, atol=2e-9):
        raise RuntimeError("A+B+C mass conservation check failed.")

    fit_config = fixture["fit"]
    lower = np.asarray(fit_config["lower_bounds"], dtype=float)
    upper = np.asarray(fit_config["upper_bounds"], dtype=float)

    def residual(parameters):
        prediction = simulate("BDF", parameters, rtol=1e-9, atol=1e-12)
        return ((prediction - observed) / sd).ravel()

    fit = least_squares(
        residual,
        np.asarray(fit_config["initial_guess"], dtype=float),
        bounds=(lower, upper),
        method="trf",
        x_scale="jac",
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-12,
        max_nfev=500,
    )
    reference = fixture["scipy_reference"]
    parameter_order = ("forward", "reverse", "drain")
    parameters = dict(zip(parameter_order, map(float, fit.x)))
    if not fit.success or not np.all(np.isfinite(fit.x)):
        raise RuntimeError("SciPy BDF bounded fit failed: " + fit.message)
    for index, key in enumerate(parameter_order):
        if abs(parameters[key] - reference["parameters"][key]) > reference["parameter_tolerance"][index]:
            raise RuntimeError(f"SciPy fitted {key} differs from the pinned reference.")
    weighted_rss = float(np.dot(fit.fun, fit.fun))
    if abs(weighted_rss - reference["weighted_residual_sum_squares"]) > reference["weighted_rss_tolerance"]:
        raise RuntimeError("SciPy weighted RSS differs from the pinned reference.")
    fitted = simulate("BDF", fit.x, rtol=1e-9, atol=1e-12)
    max_prediction_error = float(np.max(np.abs(fitted - observed)))
    if max_prediction_error > reference["prediction_tolerance"]:
        raise RuntimeError("SciPy fitted predictions exceed the pinned tolerance.")

    print(json.dumps({
        "method": "SciPy 1.17.0 solve_ivp BDF/Radau + bounded least_squares",
        "parameters": parameters,
        "weightedResidualSumSquares": weighted_rss,
        "functionEvaluations": int(fit.nfev),
        "maxBdfRadauAbsoluteDifference": float(np.max(np.abs(bdf - radau))),
        "maxFittedPredictionError": max_prediction_error,
        "massConservationMaximumAbsoluteError": float(np.max(np.abs(np.sum(bdf, axis=1) - 1.0))),
        "success": bool(fit.success),
    }, indent=2))


if __name__ == "__main__":
    main()
