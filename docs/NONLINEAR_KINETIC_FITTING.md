# Multi-step nonlinear kinetic fitting

## Implemented model

`fitMassActionMechanism` fits one bounded macroscopic rate constant per reaction in a deterministic, well-mixed mass-action ODE mechanism. It supports multiple species and multi-step mechanisms, including sequential and competing pathways. Species concentrations are integrated using classical fixed-step fourth-order Runge–Kutta (RK4). Rate constants are optimized with a bounded Levenberg–Marquardt nonlinear least-squares routine.

For reaction r, the local rate law is

`vᵣ = kᵣ ∏ᵢ cᵢ^(αᵢᵣ)`

and species balances are

`dcᵢ/dt = Σᵣ (βᵢᵣ − αᵢᵣ) vᵣ`.

All concentrations must use one consistent unit. Rate-constant units depend on reaction order and that concentration unit; the caller must supply the units string. Initial concentrations are fixed inputs, not fitted parameters. Each reaction must have exactly one fitted rate constant with explicit lower and upper bounds.

## Estimation and uncertainty

The optimizer uses finite-difference sensitivities and a damped normal-equation solve. Observation standard deviations may be supplied for every observation; these define independent weighted least squares. If omitted, observations are treated as independent and homoscedastic and covariance is scaled by residual variance. The reported covariance, standard errors and correlation matrix are local linear approximations based on the sensitivity Jacobian at the optimum.

Local identifiability is assessed from a re-orthogonalized numerical rank estimate of the weighted sensitivity Jacobian, with column scaling to reduce dependence on parameter units. The reported condition number is computed from the normalized sensitivity information matrix. The number of locally identifiable parameter directions is reported separately from the total parameter count. A rank-deficient matrix yields no covariance estimate and an explicit warning. Estimates at bounds and large scaled condition numbers are flagged.

## Numerical and scientific limitations

- RK4 uses fixed time steps and is not an adaptive stiff ODE integrator. Stiff mechanisms may require extremely small steps or a validated stiff solver.
- The optimizer is local; initial guesses and bounds matter. It does not guarantee a global optimum.
- Finite-difference Jacobians and local covariance can be unreliable for strongly nonlinear, boundary-constrained or multimodal fits.
- Measurement-error correlations are not supported. Supplied SDs are assumed known and independent.
- Initial concentrations, reaction orders and mechanism topology are fixed. Model selection, mechanism discovery, censored/zero-data likelihoods and Bayesian posterior inference are not implemented.
- Identifiability is local/practical for the supplied observations and model, not a proof of global structural identifiability.
- The implementation has synthetic recovery and rank-deficiency tests, but has not yet been compared with an external fitting package or published kinetic datasets.

Do not interpret a successful fit as proof that the reaction mechanism is chemically correct.
