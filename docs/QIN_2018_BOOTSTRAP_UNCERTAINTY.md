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

## Latest archived three-seed result

The CI experiment completed with 200 requested replicates for each of three seeds (600 requested fits per model):

- Model 4L: 600/600 converged.
- Model 4G: 597/600 converged; 3 failures were retained in the report.

Lower-bound hits across the 600 requested replicates:

| Model / parameter | Lower-bound hits | Frequency |
|---|---:|---:|
| 4L Beijing k2 | 345 / 600 | 57.5% |
| 4L Hepure k2 | 260 / 600 | 43.3% |
| 4L Toda k2 | 151 / 600 | 25.2% |
| 4G Alfa k2 | 142 / 600 | 23.7% |
| 4G Beijing k2 | 164 / 600 | 27.3% |
| 4G Hepure k2 | 262 / 600 | 43.7% |
| 4G CMC-nZVI k2 | 102 / 600 | 17.0% |

The seed-to-seed relative spread of the 97.5th percentile endpoint was 28.6% for 4L Hepure k2 and 23.6% for 4G Hepure k2. For 4L Beijing k2, the median was at the lower optimizer bound in all three seeds. These are direct signs of weak or boundary-limited identification, not evidence that the bootstrap has failed. The three Model 4G non-convergences are visible in the archived report and were not silently counted as successful samples.

The full report is archived by the GitHub Actions artifact named qin-model4-multiseed-bootstrap. Seed-specific intervals remain separate; the across-seed ranges are diagnostics and must not be treated as additional confidence intervals.

## Interpretation and limitations

This is a **stratified experimental-condition cluster bootstrap**, not a residual bootstrap, parametric measurement-error bootstrap, profile likelihood, or Bayesian posterior. It measures how the fitted rate estimates vary when the available experimental conditions are resampled within each iron type. It preserves within-series time dependence and each selected series' observed time grid, but does not generate new measurement noise.

The 35 experimental conditions are a small and uneven sample of material/treatment combinations. The bootstrap cannot create information absent from the experiment, and it does not resolve structural non-identifiability. Weakly identified Beijing/Hepure phase-2 rates may yield asymmetric, broad, multimodal or boundary-limited distributions. A percentile interval should not be interpreted as a calibrated confidence interval when the bootstrap distribution is unstable or too few replicates converge.

The fit set remains a documented reconstruction: all non-zero-time observations plus the seven CMC-nZVI time-zero records. This produces the published degrees of freedom, but has not been confirmed against original author fitting files. The bootstrap inherits that uncertainty.

## Required review before scientific reporting

- Run at least 200 replicates with more than one seed and compare interval stability.
- Review convergence failures, baseline warnings and the reported lower/upper bound-hit frequencies; do not silently discard a large or systematic subset.
- Plot per-parameter bootstrap distributions and check multimodality/asymmetry, especially for weakly identified rates.
- Compare bootstrap intervals with the local covariance approximation and the paper's tabulated uncertainty where comparable.
- Keep the inferred observation-set convention clearly labelled until author analysis files or an explicit selection rule are obtained.
