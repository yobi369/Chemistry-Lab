# Qin 2018: conditional profile-likelihood diagnostics

## Purpose

The Model 4 local covariance approximation is unreliable for weakly identified rate constants. A conditional profile refit fixes one rate constant and re-optimizes every other rate constant and every experiment-specific amplitude. The resulting objective curve shows whether materially different values of the selected rate can be offset by the remaining model parameters.

The fitter accepts `fixedRateConstantsPerHour` for conditional refits. Keys use the fitted parameter names, such as `Beijing.k2PerHour`, `Hepure.k2PerHour`, or `GLOBAL.k1PerHour`. A fixed parameter is held exactly at the requested value; it is not included in the free-parameter Jacobian. Full-fit covariance diagnostics are suppressed for conditional refits because the conditional curvature is not the covariance of the original unconstrained model.

## Reproduce

After installing the locked dependencies:

```bash
bun run scripts/benchmarks/profile_qin_2018_model4.ts \
  data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv 41
```

The benchmark evaluates Model 4L Beijing/Hepure phase-2 rates and the corresponding Model 4G grouped rates. It includes the unconstrained estimate explicitly in the log-spaced grid and reports each profile point's objective, convergence, iterations and warnings. The report identifies connected components of converged grid points that satisfy the likelihood-ratio threshold. It reports the component containing the best profile-grid point as the primary interval and preserves any additional disconnected accepted components separately. The denominator is the smaller of the baseline objective and the converged profile-grid objectives; if a conditional profile point improves the baseline, the report flags this as evidence that the unconstrained baseline fit needs refinement. All interval endpoints are grid approximations, not root-refined limits.

## Likelihood-ratio convention

For an unweighted least-squares objective with an unknown common Gaussian residual variance, the benchmark uses the approximate statistic

`n * ln(SSE_profile / SSE_min)`

and compares it with the 95th percentile of a chi-square distribution with one degree of freedom (3.84146). This is an asymptotic likelihood-ratio approximation. It assumes independent, homoscedastic Gaussian residuals and a sufficiently regular identifiable model. Those assumptions have not been established for the Qin experimental observations; the threshold is therefore a diagnostic convention, not a calibrated coverage guarantee.

The rate search spans the fitter's hard bounds, 1e-8 to 10 h^-1. If an accepted interval touches either endpoint, it is reported as boundary-limited. A boundary-limited interval must not be described as a finite two-sided confidence interval. A failed conditional refit is never counted as an accepted point.

## Data-selection caveat

The benchmark inherits the candidate Model 4 set of 35 experimental series and 287 observations (non-zero-time observations, except that the CMC-nZVI time-zero records are retained). This reconstruction reproduces the published degrees of freedom and fit statistics but has not been confirmed against the original authors' fitting files or an explicit observation-selection rule. The profile analysis cannot resolve that provenance question.

## Interpretation requirements

- Inspect the entire profile curve and any disconnected accepted components, not only the primary interval endpoints.
- If the profile grid improves the unconstrained baseline objective, refine the unconstrained fit before interpreting the profile as final.
- Report failed conditional refits and any interval touching a rate bound.
- Refine threshold crossings with a bracketed root finder before quoting numerical interval endpoints.
- Compare the profile curves with the 200–500 replicate cluster bootstrap, using multiple seeds, before making scientific claims.
- Do not call these intervals publication-grade until residual assumptions, observation selection, and independent prediction-level validation have been checked.
