# Adaptive implicit integration for stiff mass-action kinetics

## Scope

`simulateMassActionMechanismAdaptiveImplicit` is an additional fixed-parameter simulator for well-mixed mass-action mechanisms. It complements the existing fixed-step RK4 simulator; it does not replace RK4 or change the nonlinear fitter's integration path.

## Numerical method

The solver uses backward Euler,

`y(n+1) - y(n) - h f(y(n+1)) = 0`,

with a damped Newton iteration and a finite-difference Jacobian. Each attempted step is evaluated once at the full step and twice at half steps. The difference between those estimates controls acceptance and the next step size. The accepted state is the two-half-step result.

Backward Euler is A-stable and L-stable, making it suitable as a conservative baseline for stiff dissipative systems. It is first order; adaptive step-doubling controls local error but does not make it equivalent to a variable-order BDF or Radau implementation.

## API and diagnostics

The function accepts the same `KineticMechanism` representation as the RK4 simulator, a rate constant for every reaction, requested output times, and optional relative/absolute tolerances and step/Newton limits. The result includes concentrations at the requested times plus accepted/rejected step counts, Newton iterations, function evaluations, and the tolerances used.

All species use one consistent concentration unit. Rate constants retain the mass-action units implied by reaction order. The implementation rejects invalid mechanisms, rates, times, and solver settings; it also rejects failed Newton steps or step-size exhaustion rather than silently returning a partial trajectory.

## Validation

The automated stiff-system test expresses the Robertson (1966) problem as three mass-action reactions and compares the adaptive implicit trajectory with the repository's independently generated SciPy 1.17.0 BDF and Radau reference trajectories through 10^5 seconds. It also checks non-negative concentrations and conservation of A+B+C.

## Limitations

- This is an adaptive backward-Euler solver, not BDF, Radau, Rosenbrock, or a production-grade general-purpose ODE package.
- It uses a finite-difference Jacobian and dense linear algebra; large sparse reaction networks will not scale efficiently.
- The current nonlinear parameter-fitting function still uses fixed-step RK4. The implicit solver is simulation-only until it is integrated into fitting and its parameter sensitivities/covariance are validated.
- Robertson is one published stiff benchmark. More stiff mechanisms, tolerance-refinement studies, and expert numerical review remain necessary before making broad stiff-chemistry claims.
- It does not add temperature coupling, energy balances, pressure dependence, non-ideal activities, or spatial transport.

A successful Robertson comparison is evidence for this tested mechanism and tolerance range only; it is not certification for arbitrary stiff chemical systems.
