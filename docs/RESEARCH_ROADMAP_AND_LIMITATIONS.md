# Advanced research capabilities: methods and validation boundaries

This document describes the computational research methods exposed by the Chemistry Lab research kernel. It is not a claim of independent scientific certification.

## Parameter estimation

`fitFirstOrderDecay` estimates the rate constant for the narrow model y(t)=y₀ exp(−kt) using least squares on ln(y). It returns the estimated initial value, rate, residual sum of squares, R² and an approximate 95% interval based on the regression standard error. When every observation supplies a standard deviation, it uses weighted least squares with the delta-method approximation SD(ln y) ≈ SD(y)/y. Partial uncertainty metadata is rejected.

**Assumptions:** positive observations; first-order irreversible decay; constant conditions; independent errors; and, for conventional uncertainty interpretation, homoscedastic log-space errors (unweighted) or credible measurement SDs (weighted). The current implementation does not handle censored/zero observations or fit multi-step mechanisms. Do not use this estimator when those assumptions are not defensible.

## Sensitivity and uncertainty

`estimateLocalSensitivity` uses a central finite difference and reports an absolute derivative and dimensionless elasticity. Results depend on the selected relative step; verify convergence by repeating at multiple step sizes for stiff or nonlinear models.

`propagateFirstOrderRateUncertainty` propagates a positive rate uncertainty through the first-order decay prediction using a moment-matched lognormal rate distribution, a seeded Monte Carlo sample and a first-order delta-method approximation. The prediction interval represents rate-parameter uncertainty only. It excludes measurement noise, model discrepancy, uncertainty in initial concentration and correlation between parameters.

## Molecular identity and cheminformatics

The molecular identity workflow uses pinned RDKit.js MinimalLib 2026.9.1. It parses and sanitizes SMILES, generates canonical isomeric SMILES, standard InChI and InChIKey, and exposes molecular descriptors and RDKit structure data. Stereochemistry and valence validation are delegated to RDKit rather than approximated by formula-only graph checks.

The runtime is staged as same-origin JavaScript and WASM assets during the production build. A dedicated worker isolates RDKit's Embind runtime requirements; the main application CSP does not enable general `unsafe-eval`. A versioned service worker precaches the app shell and pinned RDKit assets for offline use after an initial successful online load. CI verifies asset integrity and exercises the built application in Chromium with CSP and offline caching enabled.

The integration does not yet provide a complete cheminformatics workbench. Tautomer/protomer enumeration, salt/solvate standardization, pKa prediction, conformer generation, reaction mapping, quantum calculations and broad chemical-domain validation remain outside scope. RDKit's output is only as appropriate as the selected sanitization/standardization policy and input structure.

## Thermodynamics

The standard-state helper calculates ΔG°=ΔH°−TΔS° and ln K°=−ΔG°/(RT); the van 't Hoff helper assumes temperature-independent ΔH° over the requested interval; the reaction free-energy helper calculates ΔG=ΔG°+RT ln Q.

`analyzeReactionThermodynamics` derives reaction ΔG° from species standard Gibbs formation energies and evaluates Q and ΔG at supplied dimensionless activities. A negative ΔG indicates a thermodynamic forward driving force under the declared reaction convention; positive ΔG indicates reverse driving force. It does not change kinetic rates or generate reverse channels.

These are standard-state relationships. The user must provide consistent standard-state thermodynamic data, temperature, activities and reaction quotient. The functions do not calculate activity coefficients, non-ideal solution behaviour, heat capacities, phase transitions, electrochemical potentials or pressure corrections. Equilibrium constants are dimensionless under a defined standard-state convention.

## Stiff ODE integration and fitting

`simulateMassActionMechanismAdaptiveImplicit` provides an opt-in adaptive backward-Euler solver with damped Newton iterations, a finite-difference Jacobian and step-doubling error control. `fitMassActionMechanism` can select this integrator with `integrator: 'adaptive-implicit'`; RK4 remains the default for backward compatibility.

Validation includes:
- Robertson stiff kinetics compared with independent SciPy BDF and Radau references through 10⁵ seconds, with positivity and conservation checks.
- A synthetic stiff sequential A→B→C fit with parameter recovery and predictions compared against independent SciPy BDF + bounded least squares.
- A synthetic fast reversible A⇌B relaxation with a slower B→C drain. TypeScript trajectories are compared with independent BDF and Radau references; all three rates are fitted against a SciPy BDF reference.
- A tolerance-refinement test confirming that tighter requested integration tolerances reduce the measured trajectory error.

Backward Euler is first-order and uses dense finite-difference Jacobians. It is not a variable-order BDF/Radau solver and will not scale efficiently to large sparse reaction networks. The synthetic reversible-network benchmark broadens the tested kinetic regimes but does not establish general stiff-network certification. Additional published stiff mechanisms, sparse Jacobians, multi-start fitting, and tolerance/convergence studies remain necessary.

## Reaction-network and thermodynamic integration boundary

The existing stochastic network remains a well-mixed continuous-time Markov jump model. Thermodynamic calculations are analysis functions; no automatic reverse-rate generation or detailed-balance enforcement is performed. A reversible network must not be inferred from a reversible arrow alone. Forward and reverse kinetic parameters and a clearly defined standard-state convention are required before coupling kinetics and equilibrium.

## Spatial reaction–diffusion

The research kernel includes conservative 1-D and 2-D cell-centred finite-volume transport/reaction solvers with no-flux and periodic boundaries. Diffusion uses centred face fluxes, advection uses first-order upwind fluxes, and reaction sources are limited to unimolecular first-order channels. The time integrator is explicit Euler with a combined diffusion/advection/reaction positivity restriction.

The 2-D solver has manufactured Neumann-mode mesh-refinement tests and an independent SciPy 1.17.0 BDF/Radau comparison across 8×8, 16×16, 32×32 and 64×64 meshes. The TypeScript finite-volume results are compared with the exact semi-discrete cosine eigenmode; CI checks mass conservation and successive error ratios consistent with second-order spatial convergence. See `docs/SPATIAL_REACTION_DIFFUSION_2D.md`.

This does not validate heterogeneous media, irregular geometries, advection-dominated regimes, coupled stiff reactions, anisotropic tensors, fluid dynamics, reactive interfaces or experimental spatial datasets. The explicit stability restriction can require very small time steps on fine grids.

## Independent benchmark programme

Automated analytical tests cover exact first-order survival statistics, competing first-order channel probabilities, regression recovery on noiseless first-order data, finite-difference sensitivity, uncertainty propagation and thermodynamic identities. A separate first-reaction SSA implementation is also compared statistically against the direct-method kernel on a mixed first-/second-order network. This independent in-repository implementation comparison is useful regression evidence, but is not a third-party implementation or published-data validation.

The next validation tier should compare trajectories and ensemble moments against a separately maintained external SSA implementation and published benchmark cases, record reference versions and tolerances, and include birth/death systems, reversible systems with known equilibrium distributions, and parameter-recovery studies under realistic observation noise.
