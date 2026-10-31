# Research Kernel: model specification and limitations

## Purpose

The research kernel provides a deterministic, testable implementation of a well-mixed continuous-time Markov reaction network using the Gillespie direct method. It is separate from the visual artificial-chemistry engine.

## State representation

A system state is an integer population vector \(\mathbf n=(n_1,\ldots,n_N)\). Every reaction has integer stoichiometric coefficients and a non-negative stochastic rate constant. A reaction event consumes its reactant coefficients and produces its product coefficients atomically.

## Propensity convention

For reaction \(j\):

\[
a_j(\mathbf n)=c_j\prod_i {n_i\choose\nu_{ij}}
\]

This uses the number of distinct combinations of available reactant entities. Under this convention, \(c_j\) has units s⁻¹ per available reactant combination. It must not be confused with a macroscopic concentration-based kinetic constant. In particular, no automatic conversion from M⁻¹ s⁻¹ or higher-order constants is performed.

The direct method samples:
- waiting time \(\tau=-\ln(U_1)/a_0\), with \(a_0=\sum_j a_j\);
- reaction channel \(j\) from the cumulative propensity distribution using \(U_2a_0\).

## Conservation validation

Each species includes an explicit elemental composition and integer formal charge. Every reaction is checked for:
- atom balance for every element appearing on either side;
- formal-charge balance;
- known species references;
- positive integer stoichiometric coefficients;
- unique species and reaction identifiers;
- finite, non-negative stochastic rate constants.

This is a necessary consistency check, not proof that a reaction is chemically plausible, mechanistically correct, thermodynamically feasible or experimentally observed. Isotopes, electron bookkeeping conventions, surface sites, photons, reservoirs and open-system exchange require explicit extensions rather than being silently ignored.

## Reproducibility

The simulator uses a seeded Mulberry32 pseudo-random generator. For identical validated inputs, software version and seed, the event trajectory is deterministic. This supports debugging and reproducibility but is not a cryptographic random generator. Statistical studies should use documented independent seeds and ensemble analysis.

## Current limitations

- Well-mixed assumption; no spatial diffusion or transport.
- Constant-volume interpretation; no compartment, flow or dilution model.
- No temperature dependence or automatic Arrhenius parameterisation.
- No thermodynamic potential, detailed-balance or equilibrium enforcement.
- No automatic conversion from macroscopic rate constants.
- No uncertainty propagation, parameter fitting or sensitivity analysis yet.
- No support yet for delayed reactions, explicit catalysts as non-consumed participants, chemostats, surface reactions or hybrid deterministic/stochastic solvers.
- No independent scientific benchmark campaign has been completed.

## Validation strategy

The current unit tests check basic network balance, rejection of an atom-imbalanced reaction, seed reproducibility, non-negative populations and conservation of entity count in a one-to-one isomerisation. These tests establish software behaviour for those cases only. They do not validate the algorithm against a published benchmark suite or establish scientific accuracy for arbitrary systems.

Future acceptance should include analytical birth/death processes, first-order decay waiting-time distributions, competing reaction channels, multi-reactant combinatorics, ensemble confidence intervals and comparisons with trusted reference implementations.
