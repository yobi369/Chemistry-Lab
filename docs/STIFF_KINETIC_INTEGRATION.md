# Adaptive implicit integration for stiff mass-action kinetics

## Scope

`simulateMassActionMechanismAdaptiveImplicit` is an adaptive fixed-parameter simulator for well-mixed mass-action mechanisms. It can also be selected by `fitMassActionMechanism` using `integrator: 'adaptive-implicit'`. Existing fitting and simulation calls continue to use fixed-step RK4 by default, preserving their prior behavior.

## Numerical method

The solver uses backward Euler,

`y(n+1) - y(n) - h f(y(n+1)) = 0`,

with a damped Newton iteration and a finite-difference Jacobian. Each attempted step is evaluated once at the full step and twice at half steps. The difference between those estimates controls acceptance and the next step size. The accepted state is the two-half-step result.

Backward Euler is A-stable and L-stable, making it suitable as a conservative baseline for stiff dissipative systems. It is first order; adaptive step-doubling controls local error but does not make it equivalent to a variable-order BDF or Radau implementation.

## API and diagnostics

The simulator accepts the same `KineticMechanism` representation as the RK4 simulator, a rate constant for every reaction, requested output times, and optional relative/absolute tolerances and step/Newton limits. The result includes concentrations at the requested times plus accepted/rejected step counts, Newton iterations, function evaluations, and the tolerances used. The nonlinear fitter accepts `integrator: 'adaptive-implicit'` and `adaptiveImplicitOptions`; it uses the adaptive solver for each residual evaluation, finite-difference sensitivity and final prediction. Failed trial integrations are rejected through increased LM damping and counted in `integrationFailures`. The returned `integrationDiagnostics` describe the final fitted trajectory only, not the cumulative work across all optimizer evaluations.

All species use one consistent concentration unit. Rate constants retain the mass-action units implied by reaction order. The implementation rejects invalid mechanisms, rates, times, and solver settings; it also rejects failed Newton steps or step-size exhaustion rather than silently returning a partial trajectory.

## Validation

The automated stiff-system tests express the Robertson (1966) problem as three mass-action reactions and compare the adaptive implicit trajectory with independently generated SciPy 1.17.0 BDF and Radau references through 10^5 seconds. A second test fits a stiff sequential A→B→C mechanism with k1=800 s^-1 and k2=0.03 s^-1 using the adaptive implicit path; it checks parameter recovery, predictions and solver diagnostics against a SciPy BDF + bounded least-squares fixture. CI independently regenerates the SciPy fit. The Robertson test also checks non-negative concentrations and conservation of A+B+C.

## Limitations

- This is an adaptive backward-Euler solver, not BDF, Radau, Rosenbrock, or a production-grade general-purpose ODE package.
- It uses a finite-difference Jacobian and dense linear algebra; large sparse reaction networks will not scale efficiently.
- The nonlinear fitter can opt into the adaptive implicit solver, but RK4 remains the default. The adaptive path uses finite-difference parameter sensitivities through repeated integrations; optimizer convergence and local covariance remain approximate and require broader stiff-mechanism validation.
- Robertson is one published stiff benchmark and the sequential fit fixture is synthetic. More published stiff mechanisms, tolerance-refinement studies, multi-start fitting studies, and expert numerical review remain necessary before making broad stiff-chemistry claims.
- It does not add temperature coupling, energy balances, pressure dependence, non-ideal activities, or spatial transport.

A successful Robertson comparison is evidence for this tested mechanism and tolerance range only; it is not certification for arbitrary stiff chemical systems.


## Adaptive fitting reference result

The synthetic sequential fit contains 39 species/time observations over 13 times from 0 to 100 s, with k1=800 s^-1 and k2=0.03 s^-1. The independent SciPy 1.17.0 BDF + bounded least-squares reference recovered k1=800.00000049 s^-1 and k2=0.030000000018 s^-1, with weighted RSS 3.89e-14. The TypeScript adaptive implicit fit passes the configured recovery tolerances (0.1 s^-1 for k1 and 1e-5 s^-1 for k2), keeps every fitted prediction within 5e-5 concentration units of the reference observations, and returns non-empty solver diagnostics with zero failed integration trials. The independent Python reference output is archived in the GitHub Actions artifact named stiff-kinetic-fit-scipy-reference.
