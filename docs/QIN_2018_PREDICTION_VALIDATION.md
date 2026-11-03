# Qin Model 4 prediction-level validation against SciPy

## Method

The TypeScript benchmark serializes every fitted observation for both Model 4L and 4G on the corrected 31-condition / 279-observation selection. An independent Python/SciPy implementation refits the same unweighted integrated two-phase model, solves each experiment's non-negative amplitudes independently, and emits its own predictions and residuals.

The validation aligns all 279 rows by experiment ID, iron type, time and observed hydrogen. It compares the complete predicted and residual vectors, not only fitted rate constants or aggregate goodness-of-fit. The archived JSON contains every row's TypeScript and SciPy prediction/residual, their differences, plus overall, per-iron and per-experiment summaries.

## Numerical acceptance criteria

| Metric | Model 4L | Model 4G |
|---|---:|---:|
| Prediction RMSE | <= 1e-4 µmol | <= 5e-6 µmol |
| Maximum absolute prediction difference | <= 1e-3 µmol | <= 2e-5 µmol |
| Residual Pearson correlation | >= 0.99999 | >= 0.99999 |
| Relative residual-SSE difference | <= 1e-7 | <= 1e-7 |

The criteria are applied to all 279 observations. Source row identity, time and observed H2 must match exactly within 1e-12 for numeric values. These tolerances were set from the observed independent implementation differences with a conservative margin; they are not experimental measurement tolerances.

## Observed CI result

The full comparison passed:

| Metric | Model 4L | Model 4G |
|---|---:|---:|
| Observations compared | 279 | 279 |
| Prediction RMSE | 7.39e-5 µmol | 1.77e-6 µmol |
| Maximum absolute prediction difference | 4.48e-4 µmol | 9.49e-6 µmol |
| Residual Pearson correlation | 0.9999999977 | 0.9999999999995 |
| TypeScript residual SSE | 329.18030303 | 811.05413201 |
| SciPy residual SSE | 329.18030167 | 811.05413201 |
| Relative SSE difference | about 4.1e-9 | about 1.0e-9 |

The largest 4L prediction difference occurs in the weakly identified Beijing group; its per-iron prediction RMSE is 1.45e-4 µmol and maximum difference is 4.48e-4 µmol. The other 4L groups agree more closely. All 4G groups agree within the reported tolerances.

## Interpretation

This validates numerical agreement between two independently implemented fitting/prediction paths for the selected dataset and objective. It does not establish that the selected data convention is author-confirmed, that the model is mechanistically complete, or that the parameter estimates are identifiable. Beijing/Hepure phase-2 rates remain weakly identified despite close prediction agreement: different parameter combinations can produce almost indistinguishable fitted curves.

The full row-level comparison is archived in the GitHub Actions artifact named `qin-model4-prediction-validation`. The Python benchmark enforces the numerical criteria on every CI run.
