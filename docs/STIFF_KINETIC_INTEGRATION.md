# Adaptive implicit integration for stiff mass-action kinetics

## Scope

`simulateMassActionMechanismAdaptiveImplicit` is an adaptive fixed-parameter simulator for well-mixed mass-action mechanisms. It complements the existing fixed-step RK4 simulator. The nonlinear fitter can now select either integrator with `integrationMethod: 'rk4' | 'adaptive-implicit'`; RK4 remains the default for backward compatibility.

## Numerical method

The solver uses backward Euler,

`y(n+1) - y(n) - h f(y(n+1)) = 0`,

with a damped Newton iteration and a finite-difference Jacobian. Each attempted step is evaluated once at the full step and twice at half steps. The difference between those estimates controls acceptance and the next step size. The accepted state is the two-half-step result.

Backward Euler is A-stable and L-stable, making it suitable as a conservative baseline for stiff dissipative systems. It is first order; adaptive step-doubling controls local error but does not make it equivalent to a variable-order BDF or Radau implementation.

## API and diagnostics

The simulator accepts the same `KineticMechanism` representation as the RK4 simulator, a rate constant for every reaction, requested output times, and optional relative/absolute tolerances and step/Newton limits. Its result includes concentrations at the requested times plus accepted/rejected step counts, Newton iterations, function evaluations, and the tolerances used.

The nonlinear fitter accepts `integrationMethod: 'adaptive-implicit'` and optional `adaptiveImplicitOptions`. It uses the same bounded Levenberg–Marquardt optimizer and weighted observation residuals; only the forward model integrator changes. The fit result identifies its integrator and reports aggregate simulation-call, accepted/rejected-step, Newton-iteration and RHS-evaluation counts across all objective and finite-difference evaluations. These aggregate counts describe optimizer workload, not one final trajectory. The returned covariance remains a local finite-difference approximation and must be interpreted cautiously when estimates are bound-limited or weakly identified.

All species use one consistent concentration unit. Rate constants retain the mass-action units implied by reaction order. The implementation rejects invalid mechanisms, rates, times, and solver settings; it also rejects failed Newton steps or step-size exhaustion rather than silently returning a partial trajectory.

## Validation

The automated stiff-system test expresses the Robertson (1966) problem as three mass-action reactions and compares the adaptive implicit trajectory with the repository's independently generated SciPy 1.17.0 BDF and Radau reference trajectories through 10^5 seconds. It also checks non-negative concentrations and conservation of A+B+C. A separate synthetic sequential A→B→C dataset exercises the nonlinear fitter with the adaptive implicit integrator and checks recovery of both known rate constants and solver diagnostics.

## Limitations

- This is an adaptive backward-Euler solver, not BDF, Radau, Rosenbrock, or a production-grade general-purpose ODE package.
- It uses a finite-difference Jacobian and dense linear algebra; large sparse reaction networks will not scale efficiently.
- The adaptive solver is now connected to nonlinear fitting, but it has not yet been benchmarked across a broad set of stiff inverse problems or compared with SciPy BDF/Radau inside the optimizer loop.
- Finite-difference parameter sensitivities can be noisy when adaptive step sequences change with parameter values. The current covariance remains local/linearized; profile likelihood and bootstrap should be preferred for weakly identified rates.
- Robertson is one published stiff benchmark. More stiff mechanisms, tolerance-refinement studies, and expert numerical review remain necessary before making broad stiff-chemistry claims.
- It does not add temperature coupling, energy balances, pressure dependence, non-ideal activities, or spatial transport.

A successful Robertson comparison is evidence for this tested mechanism and tolerance range only; it is not certification for arbitrary stiff chemical systems.
