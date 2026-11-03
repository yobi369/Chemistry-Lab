# Qin 2018: stratified cluster-bootstrap uncertainty

## Purpose

The published-data reproduction provides local covariance estimates from the fitted sensitivity matrix. Those estimates rely on a local linear approximation and can be unstable when rates are weakly identified. This benchmark adds a complementary, nonparametric sensitivity analysis for the Model 4 rate constants.

## Resampling design

The experimental condition (one complete time series) is the resampling unit. Each bootstrap replicate samples the observed conditions with replacement **within each iron-material group**, preserving the original number of conditions per group. All time points from a selected condition remain together, and repeated selections receive unique internal identifiers.

The 4L and 4G models are refitted to every replicate using the published-comparison unweighted objective and the same candidate observation set as the baseline reproduction. The report contains the baseline estimate and empirical 2.5th, 50th and 97.5th percentiles for each shared/grouped rate parameter. It also records baseline warnings and per-parameter counts of bootstrap estimates that hit the optimizer's lower or upper rate bounds. The seed, requested/converged/failed replicate counts and resampling unit are recorded.

## Reproduce

```bash
bun run scripts/benchmarks/bootstrap_qin_2018_model4.ts \
  data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv 200 20261103
```

Use 200–500 replicates for exploratory reporting and inspect the returned convergence count, interval shape and rate-bound warnings before interpretation. The quality workflow runs a deterministic 20-replicate smoke benchmark and archives its JSON output; that short CI run verifies the pipeline and reproducibility only. It is not a publication-grade interval estimate.

## Multi-seed experiment (200–500 replicates per seed)

Run at least three independent deterministic seeds, with 200 or more replicates per seed:

```bash
bun run scripts/benchmarks/bootstrap_qin_2018_model4_multiseed.ts \
  data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv \
  200 20261103,20261104,20261105
```

The multi-seed report records each seed's Model 4L and 4G percentile intervals, convergence/failure counts, and per-parameter lower/upper optimizer-bound hit counts. It also reports the across-seed ranges of lower, median and upper percentile endpoints, plus relative spread of the upper endpoint. These ranges are stability diagnostics, not confidence intervals. Do not pool or average the seed-specific intervals without a separately justified statistical procedure.

The quality workflow keeps the 20-replicate smoke test and additionally runs the 200-replicate, three-seed experiment, archiving the complete JSON report. This produces 600 resamples per model across independent seeded streams. Review each seed separately: a stable median with unstable upper endpoints, repeated lower-bound hits, or substantial convergence failures still indicates weak identification.

## Superseded observation-set run

An earlier 200-replicate, three-seed experiment used a reconstructed 35-series / 287-point set. The later audit of the original Tables S5/S6 showed that those tables list 31 local Model 4 conditions, not 35. The earlier bootstrap artifact is retained for traceability but is superseded and must not be used as the primary Model 4 uncertainty report. The 200-replicate, three-seed experiment is being rerun on the 31-condition / 279-observation set.

## Corrected 31-condition multi-seed result

After aligning the benchmark with the 31 conditions in Tables S5/S6, CI completed 200 replicates for each of three seeds (600 requested fits per model):

- Model 4L: 600/600 converged.
- Model 4G: 600/600 converged.

Lower-bound hits across the 600 replicates:

| Model / parameter | Lower-bound hits | Frequency |
|---|---:|---:|
| 4L Beijing k2 | 363 / 600 | 60.5% |
| 4L Hepure k2 | 238 / 600 | 39.7% |
| 4L Toda k2 | 144 / 600 | 24.0% |
| 4G Alfa k2 | 127 / 600 | 21.2% |
| 4G Beijing k2 | 153 / 600 | 25.5% |
| 4G Hepure k2 | 229 / 600 | 38.2% |
| 4G CMC-nZVI k2 | 102 / 600 | 17.0% |

The 4L Beijing k2 median is at the lower optimizer bound for all three seeds. The 97.5th-percentile endpoint for 4L CMC-nZVI k2 varies by approximately 49.9% across seeds; the corresponding 4G CMC-nZVI k2 endpoint varies by 17.4%. The 4L Hepure k2 upper endpoint varies by 8.6%, while its median remains around 4.7e-4 to 5.3e-4 h^-1 across seeds.

These results show that some phase-2 rates remain weakly identified even with 600 resamples per model. The bound-hit counts and seed-specific intervals are retained in the archived report. The seed-to-seed endpoint ranges are stability diagnostics, not additional confidence intervals.

## Interpretation and limitations

This is a **stratified experimental-condition cluster bootstrap**, not a residual bootstrap, parametric measurement-error bootstrap, profile likelihood, or Bayesian posterior. It measures how the fitted rate estimates vary when the available experimental conditions are resampled within each iron type. It preserves within-series time dependence and each selected series' observed time grid, but does not generate new measurement noise.

The 31 published Model 4 conditions are a small and uneven sample of material/treatment combinations. The bootstrap cannot create information absent from the experiment, and it does not resolve structural non-identifiability. Weakly identified Beijing/Hepure phase-2 rates may yield asymmetric, broad, multimodal or boundary-limited distributions. A percentile interval should not be interpreted as a calibrated confidence interval when the bootstrap distribution is unstable or too few replicates converge.

The current fit set uses the 31 experimental conditions listed in published Model 4 Tables S5/S6, excluding raw series #64, #65, #68 and #69 (CMC-nZVI dithionite/thiosulfite conditions) and retaining all nine time points in each selected condition (279 observations). This matches the published local-condition tables and degrees of freedom. The paper/SI do not explicitly publish a row-level inclusion list or original fitting project, so the selection is strongly supported by public evidence but is not directly author-confirmed.

## Required review before scientific reporting

- Run at least 200 replicates with more than one seed and compare interval stability.
- Review convergence failures, baseline warnings and the reported lower/upper bound-hit frequencies; do not silently discard a large or systematic subset.
- Plot per-parameter bootstrap distributions and check multimodality/asymmetry, especially for weakly identified rates.
- Compare bootstrap intervals with the local covariance approximation and the paper's tabulated uncertainty where comparable.
- Keep the inferred observation-set convention clearly labelled until author analysis files or an explicit selection rule are obtained.
