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


## Macroscopic kinetic constant conversion

The optional conversion helper assumes the macroscopic rate law

\[r = k\prod_i [S_i]^{\nu_i}\]

and a constant-volume ideal solution. Under the kernel propensity convention \(a=c\prod_i {n_i\choose\nu_i}\), the conventional mesoscopic conversion is

\[c = k(N_A V)^{1-m}\prod_i \nu_i!\]

where \(m=\sum_i\nu_i\), \(V\) is in litres, and \(k\) uses \(M^{1-m}s^{-1}\) (or \(s^{-1}\) for first order). This convention corresponds to the macroscopic mass-action law in the large-population limit. It does not remove the need to confirm the reaction order, rate-law convention, volume, solvent/solution assumptions and experimental conditions. It is not suitable for a complex mechanism whose observed rate law differs from the written stoichiometric molecularity.


## Multi-channel networks

A network text input may contain multiple neutral reaction equations, one per line. Each equation is validated independently and species with the same formula identifier are shared between channels. This parser treats formula units as neutral and cannot distinguish structural isomers with identical elemental formulae; a future structure-aware species identifier is required for that. The current UI applies one shared stochastic constant to every parsed channel, which is a convenience for exploratory models, not a scientifically general parameterisation. Researchers should not use a shared value unless justified by their model. Reversible arrow syntax is retained in parse metadata but the network converter emits only the written forward channel until a separate reverse rate is specified.


## Arrhenius parameterisation

The helper evaluates \(k(T)=A\exp(-E_a/(RT))\), with \(E_a\) in J mol⁻¹, \(T\) in K and \(R=8.31446261815324\) J mol⁻¹ K⁻¹. The pre-exponential factor \(A\) must carry the same dimensional units as the resulting macroscopic rate constant. This computes a user-specified empirical parameterisation; it does not infer activation energies, transition states, mechanisms, solvent effects or temperature-dependent activities.


## Rate parameter provenance

The versioned experiment record stores whether the stochastic constant was supplied directly, left at the illustrative preset, converted from a macroscopic rate constant, or derived from an Arrhenius parameterisation and then converted. Conversion records retain the macroscopic k, reaction order, expected units, volume and final stochastic c; Arrhenius records additionally retain A, Ea and T. This records the user's parameter pathway but does not independently verify the provenance or validity of the supplied experimental values.


## Per-channel kinetic parameters

Every reaction channel carries its own stochastic rate constant. The Research Lab allows direct per-channel entry and selects one channel at a time for macroscopic or Arrhenius-based conversion. Experiment record schema v2 stores an array of rate-parameterisation records keyed by reaction id, preventing one channel's conversion history from being mistaken for another's. A shared rate value should only be used where the model justifies it.


## Ionic species and electron bookkeeping

The equation parser supports explicit caret charge suffixes, including `Fe^3+`, `SO4^2-`, `H^+` and `e^-`. Ionic charge is represented independently from elemental composition. The explicit electron species has empty elemental composition and formal charge −1; it is the only atom-free species accepted by the validator. The parser does not infer oxidation states, protonation equilibria, coordination complexes, phase labels, isotope composition or solvent speciation. Researchers must encode chemically relevant species and charges explicitly. Balance validation establishes only elemental and formal-charge balance for the declared species.


## Automatic equation balancing

The optional equation balancer constructs an exact integer conservation matrix over all elements and, when present, formal charge. It uses rational reduced row-echelon form and converts a positive nullspace vector to primitive integer coefficients. For nullity greater than one, the current implementation searches positive free-variable assignments from 1 through 12 (up to four free variables) and selects the smallest coefficient sum encountered. This is a bounded search, not a general integer-programming proof of globally minimal coefficients for every underdetermined system. Equations with species on both sides must be simplified first. Always review the returned equation and confirm species identities.
