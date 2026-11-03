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

Zero-SD observations are not assigned infinite weight. The caller must explicitly select exclude, unweighted, or error; exclusions are counted in the fit result. This policy is an implementation safeguard, not an assertion that it matches the original authors' exact handling. The exact weighting convention and zero-SD treatment must be confirmed from the paper's fitting methods/SI before reduced χ² can be compared as a reproduction.

## Current validation boundary

Synthetic tests verify recovery of known 4L and 4G parameters and the distinct parameter-sharing constraints. The current fitter does not yet calculate the full joint covariance matrix or parameter standard errors. It has not yet been run against the full Zenodo CSV in CI because Zenodo returned HTTP 503 during the attempted download. Therefore no fitted values or χ² values are claimed as reproductions of the paper.

## Next validation gates

1. Make the checksum-pinned raw CSV reliably available and run all 35 series through the importer and fitter.
2. Confirm exact weighting, inclusion/exclusion and residual degrees-of-freedom conventions from the supporting information.
3. Compare 4L/4G rates, local amplitudes, reduced χ² and degrees of freedom against the published Tables S5/S6 and Table 1.
4. Add full joint covariance, standard errors, parameter correlations, profile-likelihood or bootstrap checks for weakly identified rates.
5. Implement Models 1–3 and reproduce the four-model comparison, not only the preferred Model 4.
6. Add independent SciPy least_squares fitting and compare predictions, objective and parameter estimates against the TypeScript implementation.
