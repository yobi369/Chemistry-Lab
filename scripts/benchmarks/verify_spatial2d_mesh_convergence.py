#!/usr/bin/env python3
"""Recompute independent 2-D diffusion mesh references with SciPy BDF and Radau."""
import json
from pathlib import Path

import numpy as np
import scipy
from scipy.integrate import solve_ivp
from scipy.sparse import diags, eye, kron

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "benchmarks/spatial2d_mesh_convergence_scipy.json"


def calculate(mesh, domain, settings):
    n = int(mesh["cells"])
    width = float(domain["widthMeters"])
    height = float(domain["heightMeters"])
    diffusion = float(domain["diffusionCoefficientM2PerS"])
    final_time = float(domain["timeSeconds"])
    dx, dy = width / n, height / n
    main = np.full(n, -2.0)
    main[0] = main[-1] = -1.0
    off = np.ones(n - 1)
    lx = diags([off, main, off], [-1, 0, 1], format="csc") / (dx * dx)
    ly = diags([off, main, off], [-1, 0, 1], format="csc") / (dy * dy)
    operator = kron(eye(n, format="csc"), lx) + kron(ly, eye(n, format="csc"))

    x = (np.arange(n) + 0.5) * dx
    y = (np.arange(n) + 0.5) * dy
    xx, yy = np.meshgrid(x, y)
    initial = 1.0 + 0.2 * np.cos(np.pi * xx / width) * np.cos(np.pi * yy / height)
    jacobian = diffusion * operator
    references = {}
    for method in ("BDF", "Radau"):
        solution = solve_ivp(
            lambda _time, state: jacobian @ state,
            (0.0, final_time),
            initial.ravel(),
            method=method,
            rtol=float(settings["rtol"]),
            atol=float(settings["atol"]),
            jac=jacobian,
        )
        if not solution.success:
            raise RuntimeError(f"SciPy {method} failed for {n}x{n}: {solution.message}")
        references[method] = solution.y[:, -1].reshape(n, n)

    nominal_dt = float(domain["explicitDtFactor"]) * min(dx, dy) ** 2 / diffusion
    steps = round(final_time / nominal_dt)
    dt = final_time / steps
    explicit = initial.copy()
    for _ in range(steps):
        explicit += dt * diffusion * (operator @ explicit.ravel()).reshape(n, n)

    exact = 1.0 + 0.2 * np.cos(np.pi * xx / width) * np.cos(np.pi * yy / height) * np.exp(
        -diffusion * np.pi**2 * (width**-2 + height**-2) * final_time
    )
    discrete_lambda_x = 4.0 / dx**2 * np.sin(np.pi / (2.0 * n)) ** 2
    discrete_lambda_y = 4.0 / dy**2 * np.sin(np.pi / (2.0 * n)) ** 2
    bdf_amplitude_factor = np.exp(-diffusion * (discrete_lambda_x + discrete_lambda_y) * final_time)
    return {
        "cells": n,
        "steps": steps,
        "timeStepSeconds": dt,
        "bdfAmplitudeFactor": float(bdf_amplitude_factor),
        "maxAbsExplicitVsBdf": float(np.max(np.abs(explicit - references["BDF"]))),
        "maxAbsBdfRadau": float(np.max(np.abs(references["BDF"] - references["Radau"]))),
        "maxAbsBdfVsContinuum": float(np.max(np.abs(references["BDF"] - exact))),
        "massError": float(abs(np.sum(explicit) - np.sum(initial))),
    }


def main():
    if scipy.__version__ != "1.17.0":
        raise SystemExit(f"Expected SciPy 1.17.0, got {scipy.__version__}")
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    results = [calculate(mesh, fixture["domain"], fixture["solverSettings"]) for mesh in fixture["meshes"]]
    for actual, expected in zip(results, fixture["meshes"]):
        for key in ("steps",):
            if actual[key] != expected[key]:
                raise RuntimeError(f"{expected['cells']}x{expected['cells']} {key} changed: {actual[key]}")
        if abs(actual["bdfAmplitudeFactor"] - expected["bdfAmplitudeFactor"]) > 2e-11:
            raise RuntimeError(f"{expected['cells']}x{expected['cells']} discrete BDF eigenmode differs from fixture")
        for key in ("maxAbsExplicitVsBdf", "maxAbsBdfRadau", "maxAbsBdfVsContinuum"):
            if abs(actual[key] - expected[key]) > max(1e-12, abs(expected[key]) * 2e-5):
                raise RuntimeError(f"{expected['cells']}x{expected['cells']} {key} differs from pinned reference")
        if actual["massError"] > 1e-9:
            raise RuntimeError(f"{expected['cells']}x{expected['cells']} explicit solver lost mass")

    errors = [item["maxAbsExplicitVsBdf"] for item in results]
    ratios = [errors[i] / errors[i + 1] for i in range(len(errors) - 1)]
    if min(ratios) < 3.7:
        raise RuntimeError(f"Mesh convergence fell below second-order expectation: {ratios}")
    if max(item["maxAbsBdfRadau"] for item in results) > 3e-9:
        raise RuntimeError("Independent SciPy BDF and Radau references disagree")

    print(json.dumps({
        "method": "SciPy 1.17.0 sparse method-of-lines solve_ivp BDF and Radau",
        "meshResults": results,
        "explicitVsBdfConvergenceRatios": ratios,
        "maxBdfRadauDifference": max(item["maxAbsBdfRadau"] for item in results),
        "success": True,
    }, indent=2))


if __name__ == "__main__":
    main()
