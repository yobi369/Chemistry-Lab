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

The CI pipeline now downloads the exact Zenodo CSV, verifies its published MD5, and parses all 35 series / 315 measurements. The paper-compatible fit selection is reconstructed as all non-zero-time observations plus the seven CMC-nZVI time-zero observations (287 points total). This gives 207 degrees of freedom for 4L and 211 for 4G, exactly as reported. The selection is inferred from the published degrees of freedom and cross-checked against Tables S5/S6; the source paper does not appear to state this filtering rule explicitly.\n\nOn this reconstructed set, the unweighted fit gives 4L SSE/df = 1.623 (paper: 1.6) and 4G SSE/df = 3.876 (paper: 3.8). The Alfa control-series coefficients also reproduce the published tables to their reported precision. The fit code returns local covariance diagnostics, but some iron-type rates remain weakly identifiable or rank-deficient, consistent with the paper's discussion of Beijing/Hepure parameter uncertainty. The SD-weighted sensitivity fit does not reproduce the paper's results and must not be presented as the reference reproduction.

## Next validation gates

1. Make the checksum-pinned raw CSV reliably available and run all 35 series through the importer and fitter.
2. Confirm exact weighting, inclusion/exclusion and residual degrees-of-freedom conventions from the supporting information.
3. Compare 4L/4G rates, local amplitudes, reduced χ² and degrees of freedom against the published Tables S5/S6 and Table 1.
4. Add full joint covariance, standard errors, parameter correlations, profile-likelihood or bootstrap checks for weakly identified rates.
5. Implement Models 1–3 and reproduce the four-model comparison, not only the preferred Model 4.
6. Add independent SciPy least_squares fitting and compare predictions, objective and parameter estimates against the TypeScript implementation.

## Models 1–3 now implemented

The same fitting API exposes the earlier alternatives described in the article:

- **Model 1 — uniform passivation:** one exponential appearance term, A(1 − exp(−kt)); k is global by iron type and A is local.
- **Model 2 — replacement:** a zero-order linear term plus an exponential term, C[t + (r − 1)(1 − exp(−kt))/k], where C = S₁,₀·kH₂,₂ and r = kH₂,₁/kH₂,₂; k and r are global by iron type, C is local.
- **Model 3 — advanced phase replacement:** the integrated two-step sequence S₁ → S₂ → inactive products, with k₁, k₂ and r global by iron type and C local. The implementation uses the analytic equal-rate limit to avoid cancellation when k₁ ≈ k₂.

All three implementations are currently covered by synthetic parameter-recovery tests. They are not yet fitted to the Zenodo observations; no paper-comparison statistics are claimed.

## Local uncertainty diagnostics

All four model fit results now expose a finite-difference sensitivity Jacobian diagnostic, local covariance matrix, parameter standard errors, parameter correlation matrix, identifiable rank and information condition number when the residual degrees of freedom are positive and the local information matrix is full rank. Singular or rank-deficient fits return null covariance/standard errors and an explicit warning instead of fabricated precision estimates.

For unweighted fits, covariance is scaled by residual SSE divided by residual degrees of freedom. For standard-deviation-weighted fits, the supplied SDs are treated as fixed known observation uncertainties and covariance uses the inverse weighted information matrix without additional residual scaling. This is a local linear approximation; it does not replace profile likelihood, bootstrap or Bayesian uncertainty analysis, and the small replicate count behind some SD estimates remains a limitation.
