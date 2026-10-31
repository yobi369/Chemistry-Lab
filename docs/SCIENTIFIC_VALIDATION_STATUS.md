# Scientific capability and validation status

**Status: advanced research-software prototype; not independently certified for scientific publication or operational laboratory decisions.** This document distinguishes implemented numerical/software capabilities from validation that is still outstanding.

## Implemented capabilities and evidence

| Area | Implemented capability | Automated evidence | Remaining boundary |
|---|---|---|---|
| Molecular identity | Official RDKit.js MinimalLib 2026.9.1; sanitized SMILES parsing; canonical isomeric SMILES; standard InChI/InChIKey; descriptors and RDKit structure JSON | CI executes the actual pinned WASM package. It checks equivalent SMILES canonicalization, ethanol/dimethyl-ether distinction, enantiomer and E/Z distinction, InChI/InChIKey generation, and invalid-carbon-valence rejection | Browser/CDN/CSP smoke test on a deployed site and vendored/hash-verified assets for offline use remain |
| Multi-step kinetics | Multi-species mass-action ODEs; fixed-step RK4; bounded Levenberg–Marquardt estimation; weighted observations; finite-difference sensitivities | Synthetic sequential A→B→C parameter-recovery tests; independent SciPy BDF trajectory comparison for a non-stiff sequential model | Fixed-step RK4 is not a stiff solver; local optimization can depend on initial guesses and bounds |
| Identifiability and uncertainty | Scaled sensitivity-Jacobian rank and condition diagnostics; local covariance, standard errors and parameter correlation matrix; joint correlated parameter sampling and prediction bands | Partial-rank deficiency tests; covariance symmetry/positive-semidefinite tests; deterministic-seed propagation tests | Local linear/Gaussian approximation only; observation-error correlation, model discrepancy and Bayesian inference are not implemented |
| Reversible thermodynamics | Reverse rates derived from species standard Gibbs energies via kᵣ=k_f/K°; Q=K and forward/reverse flux validation; reversible activity-space ODE | Analytic K=4 test; zero-net-flux equilibrium test; relaxation to a two-state analytic equilibrium | Ideal dimensionless activities and user-supplied thermodynamic data; no non-ideal activity coefficients, phases, pressure/electrochemical corrections or stiff solver |
| External kinetic benchmarks | Independent SciPy 1.17.0 BDF and Radau references; published Robertson stiff kinetics test; NIST experimental Arrhenius record | CI reproduces sequential and Robertson trajectories with BDF/Radau, checks positivity/conservation, and checks the Arrhenius implementation against NIST's tabulated rate-expression values | NIST tabulated k(T) values are calculated from the published Arrhenius expression, not raw concentration-time observations; no end-to-end raw experimental time-series fit yet |
| Spatial chemistry | 1-D and 2-D finite-volume diffusion, constant-velocity upwind transport, first-order reaction sources, no-flux/periodic boundaries | Stability/positivity checks, conservation and transport tests, manufactured-solution mesh convergence, and 2-D comparison with independent SciPy BDF/Radau method-of-lines references | Explicit fixed-step solvers; no stiff/adaptive integrator, nonuniform/unstructured meshes, heterogeneous media, 3-D, fluid momentum, electro-migration or experimental spatial-field validation |

## Benchmark provenance

- **Robertson stiff kinetics:** Robertson, H. H. (1966), “The solution of a set of reaction rate equations,” in *Numerical Analysis: An Introduction*, Academic Press, pp. 178–182. Independent SciPy BDF/Radau trajectories are committed in `benchmarks/scientific-reference-fixtures.json`.
- **NIST kinetics:** NIST Chemical Kinetics Database SRD 17, record 1992DU/HES1077-1092:1 for H + O₂ → OH + O. The record identifies an absolute-value direct experimental measurement and supplies Arrhenius parameters and tabulated k(T) values. The fixture preserves units and uncertainty metadata in `benchmarks/nist_h_o2_reference.json`.
- **Independent spatial reference:** SciPy 1.17.0 BDF/Radau method-of-lines solutions for an 8×8 no-flux diffusion case are committed in `benchmarks/spatial2d_scipy_reference.json`.

Reproduce the independent Python references with:

`python -m pip install -r requirements-benchmarks.txt`

`python scripts/benchmarks/verify_scipy_references.py`

The repository CI also runs the TypeScript comparisons and the real RDKit.js WASM smoke test.

## What is not yet complete

1. Integrate a validated stiff ODE solver into the actual multi-step fitting and simulation path, then benchmark it on Robertson and additional stiff mechanisms.
2. Add a versioned raw experimental concentration-time dataset with original measurement uncertainties, full mechanism metadata, documented units and provenance; fit it end-to-end and compare parameter confidence/correlation with published analyses.
3. Expand thermodynamic validation to non-ideal activities and independently sourced equilibrium datasets; connect thermodynamic constraints consistently to stochastic and spatial models.
4. Expand spatial verification to heterogeneous coefficients, advection-dominated cases, more manufactured solutions, 3-D and experimental concentration fields.
5. Run the browser application against the deployed RDKit loader under the production CSP and network policy; vendor and hash-verify WASM assets for reproducible/offline deployments.
6. Obtain independent review by a kineticist, thermodynamicist, cheminformatician and numerical-PDE specialist. Automated CI is not expert scientific sign-off.

## Reporting rule

A passing software test establishes that the tested implementation meets that test's assertions under the stated assumptions. It does not establish that a proposed reaction mechanism is chemically complete, that supplied parameters are experimentally valid, that a model captures a real laboratory system, or that a result is publishable. Preserve the source data, exact inputs, units, parameter bounds, solver settings, seed, package versions, commit SHA and all warnings with every reported result.
