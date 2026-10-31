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


def verify_spatial_2d():
    case = json.loads((ROOT / "benchmarks/spatial2d_scipy_reference.json").read_text())
    domain = case["domain"]
    nx, ny = domain["gridColumns"], domain["gridRows"]
    dx, dy = domain["widthMeters"]/nx, domain["heightMeters"]/ny
    diffusion = domain["diffusionCoefficientM2PerS"]
    final_time = domain["timeSeconds"]
    x = (np.arange(nx)+0.5)*dx
    y = (np.arange(ny)+0.5)*dy
    xx, yy = np.meshgrid(x,y)
    initial = (1.0+0.2*np.cos(np.pi*xx)*np.cos(np.pi*yy)).reshape(-1)

    def rhs(_time, flat):
        grid = flat.reshape(ny,nx)
        derivative = np.zeros_like(grid)
        for row in range(ny):
            for col in range(nx):
                value = grid[row,col]
                left = 0.0 if col == 0 else diffusion*(value-grid[row,col-1])/dx
                right = 0.0 if col == nx-1 else diffusion*(grid[row,col+1]-value)/dx
                down = 0.0 if row == 0 else diffusion*(value-grid[row-1,col])/dy
                up = 0.0 if row == ny-1 else diffusion*(grid[row+1,col]-value)/dy
                derivative[row,col] = (right-left)/dx+(up-down)/dy
        return derivative.reshape(-1)

    solutions = {}
    for method, fixture_key in (("BDF","referenceByBDF"),("Radau","referenceByRadau")):
        result = solve_ivp(rhs,(0.0,final_time),initial,method=method,rtol=1e-11,atol=1e-13)
        if not result.success:
            raise SystemExit(f"spatial2d/{method} failed: {result.message}")
        grid = result.y[:,-1].reshape(ny,nx)
        reference = np.asarray(case[fixture_key],dtype=float)
        if not np.allclose(grid,reference,rtol=2e-7,atol=2e-12):
            raise SystemExit(f"spatial2d/{method} differs from frozen reference")
        if np.min(grid)<-2e-12 or abs(float(grid.sum())-float(initial.sum()))>2e-9:
            raise SystemExit(f"spatial2d/{method} violated positivity or no-flux conservation")
        solutions[method]=grid
        print(f"PASS spatial2d/{method}: nfev={result.nfev}, njev={result.njev}, nlu={result.nlu}")
    if not np.allclose(solutions["BDF"],solutions["Radau"],rtol=2e-7,atol=2e-12):
        raise SystemExit("spatial2d: independent BDF and Radau solutions disagree")
    print("PASS spatial2d: independent method-of-lines BDF/Radau agreement, positivity and conservation")

def main():
    verify_case("sequentialAtoBtoC",
        lambda t,y: [-0.7*y[0], 0.7*y[0]-0.25*y[1], 0.25*y[1]],
        [1.0,0.0,0.0], 1e-12, 1e-14)
    verify_case("robertson1966",
        lambda t,y: [-0.04*y[0]+1e4*y[1]*y[2],
                     0.04*y[0]-1e4*y[1]*y[2]-3e7*y[1]**2,
                     3e7*y[1]**2],
        [1.0,0.0,0.0], 1e-11, [1e-14,1e-18,1e-14])
    verify_spatial_2d()

if __name__ == "__main__":
    main()
