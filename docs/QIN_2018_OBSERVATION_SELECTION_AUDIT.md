# Qin 2018 Model 4 observation-selection audit

## Conclusion

The strongest public-evidence reconstruction for Models 4L and 4G is **31 experimental conditions and 279 observations**: use all nine time points for the 31 conditions listed in supporting-information Tables S5 and S6, and exclude four additional CMC-nZVI dithionite/thiosulfite series that remain in the raw CSV.

This convention is supported by the row count in Tables S5/S6, the fitted-parameter count, the published degrees of freedom, and the rounded reduced chi-square values. The paper and supporting information do not explicitly publish a row-level observation inclusion list or the original fitting project, so this is not direct author confirmation.

## Public source evidence

- Main article: Qin et al., *Modeling the Kinetics of Hydrogen Formation by Zerovalent Iron: Effects of Sulfidation on Micro- and Nano-Scale Particles*, DOI [10.1021/acs.est.8b04436](https://doi.org/10.1021/acs.est.8b04436).
- Supporting information: Tables S5 and S6 list the local Model 4 condition rows and their A/B coefficients; Table 1 reports 4L/4G degrees of freedom of 207/211 and defines df as number of points minus number of fitted parameters.
- Raw dataset: [Zenodo 10.5281/zenodo.1979080](https://doi.org/10.5281/zenodo.1979080). The record describes the CSV as raw data/labels and the accompanying Igor Pro PXP as data and graphs **without fits**; it does not provide the original fitting project.

Tables S5/S6 contain 31 conditions distributed as follows:

| Iron type | Conditions listed |
|---|---:|
| Alfa | 10 |
| Beijing | 8 |
| Hepure | 6 |
| Toda | 4 |
| CMC-nZVI | 3 |
| **Total** | **31** |

The vendored raw CSV contains 35 series and 315 measurements (nine observations per series). Four CMC-nZVI conditions appear in the CSV but not in the Model 4 coefficient tables:

- #64 — CMC nZVI + 3000 µM dithionite
- #65 — CMC nZVI + 9000 µM dithionite
- #68 — CMC nZVI + 3000 µM thiosulfite
- #69 — CMC nZVI + 9000 µM thiosulfite

The current Model 4 benchmark excludes those four series and retains all nine observations for each of the 31 table-listed conditions.

## Degrees-of-freedom arithmetic

For 4L, the model has ten iron-type-specific rate constants and two local amplitudes for each condition:

`10 + (2 × 31) = 72` fitted parameters, therefore `279 − 72 = 207` df.

For 4G, one shared k1 plus five iron-type-specific k2 values and two local amplitudes per condition gives:

`6 + (2 × 31) = 68` fitted parameters, therefore `279 − 68 = 211` df.

These match the published 4L and 4G degrees of freedom.

## Alternative-set comparison

The CI audit compares three candidate sets:

| Candidate | Series | Observations | 4L df | 4G df | 4L reduced statistic | 4G reduced statistic |
|---|---:|---:|---:|---:|---:|---:|
| Published-table set: 31 × 9 | 31 | 279 | 207 | 211 | 1.5902 | 3.8439 |
| Earlier reconstructed set | 35 | 287 | 207 | 211 | 1.6234 | 3.8767 |
| All raw series and points | 35 | 315 | 235 | 239 | 1.4305 | 3.4230 |

Both the 31/279 and 35/287 candidates happen to reproduce the published df and rounded reduced statistics. The 35/287 construction was therefore not uniquely identified by df arithmetic. It is superseded because it includes four experimental conditions absent from Tables S5/S6. The all-raw 35/315 fit does not reproduce the published df/statistics.

The current 31/279 TypeScript fits and independent SciPy fits agree on degrees of freedom, reduced residual statistics, and well-identified reference parameters. The Beijing/Hepure phase-2 estimates can differ from the table values because those parameters have flat/non-unique minima; the paper itself notes insufficient stage-2 curvature and poorly defined Model 4L Beijing parameters. Those weakly identified coefficients must not be treated as decisive evidence for or against the selected data set.

## Remaining uncertainty

The published material supports the 31-condition set, but does not explicitly state the row-level inclusion rule or explain why the four extra CMC-nZVI series are not in Tables S5/S6. The Zenodo archive contains raw CSV and plots without fits, not the original nonlinear-regression project. Definitive confirmation would require the authors' original fit data/project or an explicit statement from the corresponding author.

Until then, the repository labels 31/279 as the best-supported public-evidence selection, preserves all 35 raw series unchanged, and keeps the alternative-selection audit in CI. The former 35/287 bootstrap/profile artifacts are retained only for traceability and are superseded for scientific reporting.
