# Qin et al. (2018) kinetic-model reproduction

## Source and scope

- Raw observations: Zenodo DOI https://doi.org/10.5281/zenodo.1979080
- Publication: Qin et al., Environmental Science & Technology 52(23), 13887–13896 (2018), DOI https://doi.org/10.1021/acs.est.8b04436
- Measurements: time in hours, H₂ amount in µmol, replicate standard deviation in µmol.
- The paper reports 35 experimental conditions across Alfa, Beijing, Hepure, Toda and CMC-nZVI materials.

## Model 4: independent changes in two reactive phases

The paper defines two independently decaying reactive-phase quantities:

\[
S_1(t)=S_{1,0}e^{-k_1t}, \qquad S_2(t)=S_{2,0}e^{-k_2t}.
\]

The hydrogen-generation rate is the sum of pseudo-first-order contributions:

\[
\frac{d[H_2]}{dt}=k_{H_2,1}S_1(t)+k_{H_2,2}S_2(t).
\]

After integration, the fitted appearance curve is:

\[
[H_2](t)=A(1-e^{-k_1t})+B(1-e^{-k_2t}),
\]

where

\[
A=\frac{k_{H_2,1}S_{1,0}}{k_1}, \qquad
B=\frac{k_{H_2,2}S_{2,0}}{k_2}.
\]

Thus A and B are asymptotic H₂ contributions (µmol), and k1/k2 are first-order decay constants (h⁻¹). The model fitter estimates A and B as local, non-negative linear amplitudes for each experimental series, conditional on the shared rates.

### Parameter-sharing schemes

- **4L (minimally global):** k1 and k2 are shared within each base iron type; A and B are local to every experimental condition.
- **4G (more globally constrained):** k1 is shared across the entire dataset; k2 is shared within each base iron type; A and B remain local.

The treatment label (acid wash, sulfide, dithionite or thiosulfate) does not create a new iron-type rate group. The paper reports reduced χ² = 1.6 with 207 degrees of freedom for 4L and reduced χ² = 3.8 with 211 degrees of freedom for 4G. These are comparison targets, not results established by this code.

## Numerical implementation

For each candidate vector of global log-rate constants, the two local amplitudes per series are solved by a constrained two-variable weighted linear least-squares problem. The global rate constants are then optimized with a damped Gauss–Newton/Levenberg–Marquardt iteration. This variable-projection structure avoids needlessly optimizing all local amplitudes as nonlinear variables.

The implementation exposes two objective modes:

- unweighted: ordinary sum of squared H₂ residuals.
- standard-deviation: inverse-variance weighted sum, using 1/SD².

Zero-SD observations are not assigned infinite weight. The caller must explicitly select exclude, unweighted, or error; exclusions are counted in the fit result. This policy is an implementation safeguard, not an assertion that it matches the original authors' exact handling. A real-data comparison established that the paper-compatible parameter estimates and reported reduced χ² values are reproduced by the unweighted objective. The SD-weighted objective produces materially different coefficients and a reduced weighted residual statistic near 172, so it is retained only as a sensitivity analysis, not as the reproduction mode.

## Current validation boundary

The CI pipeline now downloads the exact Zenodo CSV, verifies its published MD5, and parses all 35 series / 315 measurements. The paper-compatible fit selection is reconstructed as all non-zero-time observations plus the seven CMC-nZVI time-zero observations (287 points total). This gives 207 degrees of freedom for 4L and 211 for 4G, exactly as reported. The selection is inferred from the published degrees of freedom and cross-checked against Tables S5/S6; the source paper does not appear to state this filtering rule explicitly.

On the Model 4 set, the unweighted fit gives 4L SSE/df = 1.623 (paper: 1.6; df 207) and 4G SSE/df = 3.876 (paper: 3.8; df 211). Alfa control-series coefficients reproduce Tables S5/S6 to reported precision; Toda and CMC rate groups also closely reproduce their tabulated values. Beijing/Hepure phase-2 rates remain weakly identified, consistent with the authors' reported large uncertainties.

Models 1–3 were also fitted to the 31-condition / 279-point set represented in Tables S2–S4. Their unweighted SSE/df values are 44.787 (paper: 45; df 243), 7.156 (paper: 7.2; df 238), and 5.329 (paper: 5.3; df 233), respectively. Alfa control-series coefficients reproduce Tables S2–S4. The four additional CMC-nZVI dithionite/thiosulfate conditions appear in the Model 4 table set but not in Tables S2–S4; this model-specific coverage is encoded explicitly in the real-data CI benchmark.

The SD-weighted sensitivity fit produces materially different coefficients and a reduced weighted residual statistic near 172, so it is retained only as a sensitivity analysis, not as the reference reproduction. The local covariance code returns diagnostics; some fit matrices are ill-conditioned or rank-deficient, so standard errors are withheld rather than fabricated.

## Next validation gates

1. Vendor the checksum-verified CSV so reproducible validation does not depend on Zenodo availability; CI currently downloads it and verifies the published MD5 before every real-data fit.
2. Independently confirm the inferred model-specific observation sets against author fitting files if they can be obtained; the current selections are supported by the exact published degrees of freedom and coefficient/statistic reproduction.
3. Improve multi-start and identifiability handling for weakly constrained Beijing/Hepure phase-2 parameters, preserving non-unique minima and wide uncertainty.
4. Validate local covariance against the paper's tabulated standard errors and add profile-likelihood/bootstrap intervals for weakly identified parameters.
5. Add an independent SciPy implementation of all four Qin global fits and compare fitted curves, SSE, global rates, local amplitudes and residual diagnostics against the TypeScript implementation.
