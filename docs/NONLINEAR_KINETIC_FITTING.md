# Multi-step nonlinear kinetic fitting

## Implemented model

`fitMassActionMechanism` fits one bounded macroscopic rate constant per reaction in a deterministic, well-mixed mass-action ODE mechanism. It supports multiple species and multi-step mechanisms, including sequential and competing pathways. Species concentrations use classical fixed-step fourth-order Runge–Kutta (RK4) by default. An opt-in `integrator: 'adaptive-implicit'` path uses the repository's adaptive backward-Euler solver with step-doubling error control for stiff mechanisms. Rate constants are optimized with the same bounded Levenberg–Marquardt nonlinear least-squares routine.

For reaction r, the local rate law is

`vᵣ = kᵣ ∏ᵢ cᵢ^(αᵢᵣ)`

and species balances are

`dcᵢ/dt = Σᵣ (βᵢᵣ − αᵢᵣ) vᵣ`.

All concentrations must use one consistent unit. Rate-constant units depend on reaction order and that concentration unit; the caller must supply the units string. Initial concentrations are fixed inputs, not fitted parameters. Each reaction must have exactly one fitted rate constant with explicit lower and upper bounds.

## Estimation and uncertainty

The optimizer uses finite-difference sensitivities and a damped normal-equation solve. Observation standard deviations may be supplied for every observation; these define independent weighted least squares. If omitted, observations are treated as independent and homoscedastic and covariance is scaled by residual variance. The reported covariance, standard errors and correlation matrix are local linear approximations based on the sensitivity Jacobian at the optimum. The companion `propagateCorrelatedKineticUncertainty` utility draws joint multivariate-normal parameter samples using the full covariance matrix, rejects samples outside declared physical bounds, and propagates accepted draws through the nonlinear mechanism to produce prediction bands.

Local identifiability is assessed from a re-orthogonalized numerical rank estimate of the weighted sensitivity Jacobian, with column scaling to reduce dependence on parameter units. The reported condition number is computed from the normalized sensitivity information matrix. The number of locally identifiable parameter directions is reported separately from the total parameter count. A rank-deficient matrix yields no covariance estimate and an explicit warning. Estimates at bounds and large scaled condition numbers are flagged.

## Numerical and scientific limitations

- RK4 uses fixed time steps and is not an adaptive stiff ODE integrator. The opt-in adaptive backward-Euler path is L-stable but first order, uses finite-difference Newton Jacobians and dense linear algebra, and is not a substitute for variable-order BDF or Radau in all systems. It has independent SciPy BDF validation on one stiff sequential first-order fitting fixture and should be treated as an early validated option rather than a general-purpose production solver.
- The optimizer is local; initial guesses and bounds matter. It does not guarantee a global optimum.
- Finite-difference Jacobians and local covariance can be unreliable for strongly nonlinear, boundary-constrained or multimodal fits.
- Measurement-error correlations are not supported. Supplied SDs are assumed known and independent.
- Initial concentrations, reaction orders and mechanism topology are fixed. Model selection, mechanism discovery, censored/zero-data likelihoods and Bayesian posterior inference are not implemented.
- Identifiability is local/practical for the supplied observations and model, not a proof of global structural identifiability.
- The implementation has synthetic recovery and rank-deficiency tests, but has not yet been compared with an external fitting package or published kinetic datasets.

Do not interpret a successful fit as proof that the reaction mechanism is chemically correct.


## Cross-language reference parity

CI uses the shared fixture at `scripts/benchmarks/fixtures/sequential-kinetic-fit.json` for both implementations. It contains the same sequential A → B → C mechanism, deterministic perturbed concentration observations, per-observation standard deviation, parameter bounds, and initial guesses.

- The SciPy 1.17.0 reference uses bounded trust-region reflective `least_squares` from four initial guesses and checks multi-start stability against pinned reference estimates and weighted residual sum of squares.
- The TypeScript test loads that exact fixture and runs `fitMassActionMechanism` with the same observations, uncertainties, bounds, and integration settings.
- The TypeScript result must converge, report local identifiability, and agree with the pinned SciPy estimates and weighted residual sum of squares within explicit fixture tolerances.

This is a controlled synthetic cross-implementation regression test, not validation against experimental or published measurements. It currently covers one sequential first-order mechanism and does not establish parity for arbitrary reaction orders, stiff systems, competing pathways, or all optimizer starting conditions. Do not interpret agreement on this fixture as proof that a reaction mechanism is chemically correct.


## Stiff fitting validation

The adaptive path is exercised with a synthetic sequential A→B→C mechanism (k1=800 s^-1, k2=0.03 s^-1), whose rate scales differ by more than four orders of magnitude. The TypeScript fit is checked against a SciPy 1.17.0 BDF + bounded least-squares reference for parameter recovery and all observed predictions. CI runs the independent Python benchmark. This validates the integration path for this test mechanism only; it does not establish broad stiff-mechanism support.
