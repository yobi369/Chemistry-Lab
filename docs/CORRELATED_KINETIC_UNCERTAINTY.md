# Correlated kinetic parameter uncertainty propagation

`propagateCorrelatedKineticUncertainty` accepts the fitted parameter mean vector, full covariance matrix and physical parameter bounds. It draws jointly correlated multivariate-normal parameter samples using a Cholesky factorization, rejects draws outside the declared bounds, simulates the nonlinear mass-action mechanism for each accepted draw, and returns mean, standard deviation, median and central confidence quantiles for every species at each requested time.

## Interpretation

The resulting bands propagate the off-diagonal covariance terms; they are not equivalent to independently sampling each rate constant. A fixed PRNG seed makes the sampling reproducible. Bounds are enforced by rejection sampling, so the resulting accepted distribution is a truncated multivariate normal rather than the original unbounded Gaussian.

## Assumptions and limitations

- The input covariance is treated as a valid local parameter covariance matrix from the nonlinear fit.
- The Gaussian approximation is local; it does not represent skewed, multimodal or strongly non-Gaussian posteriors.
- The covariance must be symmetric positive semidefinite.
- Initial concentrations and mechanism topology remain fixed.
- Parameter draws outside the declared bounds are rejected; tight bounds or large uncertainty may require a higher attempt budget and can cause the routine to fail explicitly.
- Prediction bands inherit the fixed-step RK4 integration error and are not a substitute for posterior predictive checks or Bayesian inference.
- Observation noise and model discrepancy are not added to the simulated trajectories.
