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

The benchmark evaluates Model 4L Beijing/Hepure phase-2 rates and the corresponding Model 4G grouped rates. It includes the unconstrained estimate explicitly in the log-spaced grid and reports each profile point's objective, convergence, iterations and warnings. The report identifies connected components of converged grid points that satisfy the likelihood-ratio threshold. It reports the component containing the best profile-grid point as the primary interval and preserves any additional disconnected accepted components separately. The denominator is the smaller of the baseline objective and the converged profile-grid objectives; if a conditional profile point improves the baseline, the report flags this as evidence that the unconstrained baseline fit needs refinement. The profile benchmark brackets each finite endpoint on the log-spaced grid and applies 12 log-space bisection steps. Endpoints remain approximate because the bracket grid can miss additional narrow components and the likelihood-ratio calibration itself is asymptotic.

## Likelihood-ratio convention

For an unweighted least-squares objective with an unknown common Gaussian residual variance, the benchmark uses the approximate statistic

`n * ln(SSE_profile / SSE_min)`

and compares it with the 95th percentile of a chi-square distribution with one degree of freedom (3.84146). This is an asymptotic likelihood-ratio approximation. It assumes independent, homoscedastic Gaussian residuals and a sufficiently regular identifiable model. Those assumptions have not been established for the Qin experimental observations; the threshold is therefore a diagnostic convention, not a calibrated coverage guarantee.

The rate search spans the fitter's hard bounds, 1e-8 to 10 h^-1. If an accepted interval touches either endpoint, it is reported as boundary-limited. A boundary-limited interval must not be described as a finite two-sided confidence interval. A failed conditional refit is never counted as an accepted point.

## Data-selection caveat

The benchmark now uses the 31 experimental conditions listed in published Model 4 Tables S5/S6, excluding raw series #64, #65, #68 and #69 (CMC-nZVI dithionite/thiosulfite conditions) and retaining all nine time points for each selected condition: 279 observations. This selection reproduces the published 4L/4G degrees of freedom and rounded reduced chi-square values. The paper and SI do not explicitly publish a row-level inclusion list or original fitting project, so this is the strongest public-evidence reconstruction, not direct author confirmation.

## Interpretation requirements

- Inspect the entire profile curve and any disconnected accepted components, not only the primary interval endpoints.
- If the profile grid improves the unconstrained baseline objective, refine the unconstrained fit before interpreting the profile as final.
- Report failed conditional refits and any interval touching a rate bound.
- Inspect the 12-step log-space endpoint refinement and increase grid density when the profile curve is sharply curved or multimodal.
- Compare the profile curves with the 200–500 replicate cluster bootstrap, using multiple seeds, before making scientific claims.
- Do not call these intervals publication-grade until residual assumptions, observation selection, and independent prediction-level validation have been checked.
