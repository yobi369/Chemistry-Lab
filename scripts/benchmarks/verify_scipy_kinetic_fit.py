#!/usr/bin/env python3
"""Independent SciPy nonlinear-fit reference for a sequential A -> B -> C mechanism.

The fixture is generated analytically, then fit from multiple initial guesses with
SciPy's bounded trust-region reflective least_squares implementation. This checks
the reference optimizer/model and produces stable targets for cross-implementation
comparisons; it does not execute the browser TypeScript fitter.
"""
import numpy as np
import scipy
from scipy.optimize import least_squares

if scipy.__version__ != "1.17.0":
    raise SystemExit(f"Expected SciPy 1.17.0, got {scipy.__version__}")

TRUE = np.array([0.7, 0.25])
TIMES = np.array([0.0, .25, .5, .75, 1., 1.5, 2., 3., 4., 5.])
SD = 0.002


def predict(theta):
    k1, k2 = theta
    a = np.exp(-k1 * TIMES)
    if abs(k2-k1) < 1e-10:
        b = k1 * TIMES * np.exp(-k1 * TIMES)
    else:
        b = k1 / (k2-k1) * (np.exp(-k1*TIMES)-np.exp(-k2*TIMES))
    c = 1.0-a-b
    return np.stack([a,b,c], axis=1)


# Fixed deterministic perturbation, representing reproducible measurement noise.
NOISE = SD * np.array([
    [0,0,0],[.2,-.4,.2],[-.5,.3,.2],[.4,-.2,-.2],
    [-.3,.5,-.2],[.1,-.3,.2],[-.2,.1,.1],[.3,-.1,-.2],
    [-.1,.2,-.1],[.2,-.2,0],
])
OBSERVED = predict(TRUE) + NOISE


def residual(theta):
    return ((predict(theta)-OBSERVED)/SD).ravel()


def main():
    starts = ([.15,.15], [1.4,.8], [.3,1.2], [.9,.05])
    solutions = []
    for start in starts:
        result = least_squares(residual, start, bounds=([.001,.001],[2.,2.]),
                               method="trf", x_scale="jac", ftol=1e-12,
                               xtol=1e-12, gtol=1e-12, max_nfev=2000)
        if not result.success or not np.all(np.isfinite(result.x)):
            raise SystemExit(f"fit failed from {start}: {result.message}")
        solutions.append(result.x)
        print(f"PASS start={start}: k1={result.x[0]:.8f}, k2={result.x[1]:.8f}, "
              f"weighted_RSS={2*result.cost:.6f}, nfev={result.nfev}")
    solutions=np.asarray(solutions)
    if not np.allclose(solutions, solutions[0], rtol=2e-5, atol=2e-6):
        raise SystemExit(f"initialization-dependent solutions: {solutions}")
    if not np.allclose(solutions[0], [0.7,0.25], atol=0.003, rtol=0):
        raise SystemExit(f"fit did not recover generating parameters: {solutions[0]}")
    print("PASS SciPy bounded nonlinear reference: stable multi-start recovery")


if __name__ == "__main__":
    main()
