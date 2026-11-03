# Qin–Tratnyek (2018) hydrogen evolution dataset

Dataset DOI: https://doi.org/10.5281/zenodo.1979080  
Publication DOI: https://doi.org/10.1021/acs.est.8b04436  
License: CC BY 4.0 (as indexed by the NLM dataset catalogue).

The source is a wide CSV with two header rows and three columns per experimental series: elapsed time (hours), mean hydrogen amount (µmol), and standard deviation (µmol). It covers hydrogen generated during corrosion of granular zerovalent iron under different pretreatment and sulfidation conditions. The paper compares four kinetic models using global nonlinear regression.

## Ingestion policy

- Preserve the original CSV unchanged when vendoring it, with retrieval date and source checksum.
- The importer creates a normalized long-form view and retains experiment label and original row/column coordinates.
- Negative H2 values are retained as measured baseline noise; they are not clipped.
- Zero SD values are retained and counted. They must not be used directly as inverse-variance weights.
- Entirely empty triplets are absent observations. Partially populated triplets, malformed values, negative times, and negative SD values are errors.
- No smoothing, outlier removal, baseline correction, imputation, or replicate aggregation occurs during ingestion.

## Model reproduction

The preferred paper model represents two independently decaying reactive phases. The observed rate is the sum of two first-order contributions, giving a sum of two exponential-appearance terms after integration. The publication discusses globally shared rate-related parameters grouped by iron type and experiment-local phase quantities under multiple globality schemes. Exact parameter definitions and constraints must be transcribed from the article and supporting information before numerical reproduction is claimed.

## Citation

Qin, H., Guan, X., Bandstra, J. Z., Johnson, R. L., & Tratnyek, P. G. (2018). Modeling the Kinetics of Hydrogen Formation by Zerovalent Iron: Effects of Sulfidation on Micro- and Nano-Scale Particles. Environmental Science & Technology, 52(23), 13887–13896. https://doi.org/10.1021/acs.est.8b04436

Tratnyek, P. G., Qin, H., & Guan, X. (2018). Raw data from Qin et al. (2018). Zenodo. https://doi.org/10.5281/zenodo.1979080

## Re-fetch and verify the source file

The raw CSV is currently fetched from the versioned Zenodo record in CI rather than silently copied from a secondary source. The manifest pins the filename, DOI, units, CC BY 4.0 licence and Zenodo-published MD5 checksum.

```bash
mkdir -p data/experimental/qin-2018
curl --fail --location \
  "https://zenodo.org/records/1979080/files/QinTratnyek18-H2vsTime-Data.csv?download=1" \
  --output data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv
md5sum data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv
bun run scripts/benchmarks/verify_qin_2018_dataset.ts data/experimental/qin-2018/QinTratnyek18-H2vsTime-Data.csv
```

The CI job downloads the same file, checks the published checksum, parses the full dataset through the production importer and asserts the series count and 120-hour horizon. The raw file is not yet committed to Git; the pinned source record is the current data source of truth.
