# Chemistry Lab — Artificial & Computational Chemistry Research Platform

Chemistry Lab is an experimental platform for exploring artificial chemistry, reaction networks, stochastic chemical kinetics and emergent behaviour. It combines an interactive visual sandbox with a separately defined research kernel for well-mixed stochastic reaction systems.

> **Scientific status:** This repository is an active research-software prototype. The visual particle sandbox is qualitative and is not a molecular-dynamics, quantum-chemistry or validated physical-chemistry solver. The research kernel implements a documented Gillespie direct-method model for explicitly specified reaction networks. Results are only as scientifically meaningful as the network, parameters, units and assumptions supplied by the researcher.

## Current capabilities

- Interactive 2D particle-based artificial-chemistry sandbox.
- 3D spatial visualisation and reaction-network exploration.
- Rule-based artificial chemistry, reaction-diffusion and genetic-string experiments.
- Custom reaction grammar and experiment presets.
- Export/share utilities for experiment configurations.
- **Research kernel foundation:** reaction-network data model, elemental and charge-balance validation, initial-population validation, deterministic seeded random-number generation, and a well-mixed continuous-time Gillespie stochastic simulation algorithm (SSA).
- Test and type-check scripts suitable for continuous integration.

## Research kernel: what it does

The kernel in `src/research/` is intentionally isolated from the visual particle engine.

For reaction channel \(j\), it calculates the stochastic propensity

\[
a_j(\mathbf n) = c_j \prod_i \binom{n_i}{\nu_{ij}}
\]

where \(n_i\) is the current count of species \(i\), \(\nu_{ij}\) is its reactant stoichiometric coefficient, and \(c_j\) is a stochastic rate constant expressed in **s⁻¹ per available reactant combination**. The next event time is sampled from an exponential distribution using the total propensity, and the selected reaction is sampled in proportion to its propensity.

The simulator supports:
- reproducible trajectories for a fixed seed and identical inputs;
- explicit integer molecule counts;
- arbitrary positive-integer stoichiometric coefficients;
- reaction-network validation for elemental and formal-charge conservation;
- bounded event counts and cooperative cancellation hooks;
- event-level records with time and post-event populations.

### Important rate-constant distinction

The kernel's stochastic constant is **not** a macroscopic rate constant in units such as M⁻¹ s⁻¹. Converting experimental rate constants requires a defined reaction order, volume, concentration convention and Avogadro-constant treatment. The software deliberately does not infer those missing quantities. A researcher must document the conversion and assumptions before comparing simulations with experimental kinetics.

## Existing visual sandbox

The visual sandbox uses simplified particle motion, collision rules and stochastic reaction triggers to create an interactive artificial-chemistry environment. It is useful for qualitative exploration of rule systems and emergent patterns. It does not currently enforce physical conservation laws, solve molecular forces, or represent calibrated temperature, energy or spatial concentration fields. Its telemetry must not be reported as measured physical quantities.

## Getting started

Requirements:
- Node.js 20 or newer recommended
- npm (or Bun, if preferred)

```bash
npm install
npm run dev
```

Open the local Vite URL printed in the terminal.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
```

The research kernel tests use Node's built-in test runner through the repository's existing `tsx` development dependency.

## Project structure

```text
src/
  components/     Interactive research and visualisation UI
  data/           Built-in artificial-chemistry presets
  engine/         Existing visual particle and artificial-life engines
  research/       Typed stochastic reaction-network research kernel
  types/          Shared visual application types
  utils/          Application utilities
```

## Scientific validation roadmap

1. Add documented benchmark networks with analytical or literature reference expectations.
2. Validate stochastic ensemble statistics against known distributions and deterministic rate equations in the appropriate large-population limit.
3. Add uncertainty propagation, parameter estimation and sensitivity analysis.
4. Add explicit unit-aware physical quantities and concentration/volume-aware rate-constant conversion.
5. Add a provenance-rich experiment format, immutable input snapshots and machine-readable exports.
6. Add molecular structure/geometry workflows only alongside validated computational backends and clear method provenance.
7. Obtain independent domain-expert review before making research-grade accuracy claims.

## Reproducibility and reporting

For every reported result, preserve the complete reaction network, initial populations, stochastic rate constants and units, simulation duration, seed, software version/commit, and relevant modelling assumptions. A saved plot without its underlying configuration is not a reproducible result.

## Scope and safety

Chemistry Lab is computational research software, not an operational laboratory protocol generator. It does not establish that a proposed synthesis is feasible, safe, selective or experimentally reproducible. Do not use generated or simulated results as a substitute for peer-reviewed evidence, validated computational chemistry packages, laboratory risk assessment or qualified scientific review.

## Contributing

Contributions should include:
- a clear scientific or engineering rationale;
- explicit assumptions and units;
- tests covering expected behaviour and failure cases;
- references for scientific claims or benchmark data;
- no unsupported claims of validation or experimental accuracy.

## License

No license has yet been selected. Until a license is added, normal copyright restrictions apply; do not assume the project is open-source licensed for reuse.

## Stochastic Research Lab

The application now includes a dedicated **Research Lab · SSA** workspace. It exposes a reproducible event-driven simulation with editable initial population, time horizon, stochastic rate constant and random seed. The built-in hydrogen dissociation network is an illustrative software-verification example; its rate parameter is not an experimentally calibrated value. See [the research-kernel model specification](docs/RESEARCH_KERNEL.md) before interpreting results.


## Formula and equation validation

The research kernel parses neutral molecular/formula-unit strings, including nested parentheses/square brackets and hydrate notation, and converts typed equations into reaction networks for atom/charge balance checks. Ionic charge notation and phase labels are not inferred; formula strings are treated as neutral formula units. Reversible arrows are preserved as metadata, while the current SSA network builder represents the written forward direction only.


## Experiment provenance and export

Completed research-kernel runs can be exported as a versioned JSON reproducibility record containing the exact reaction network, initial populations, stochastic-rate-constant convention, duration, seed, assumptions and full event trajectory. A companion CSV export contains event times, reaction identifiers and per-species populations after each event. Keep the JSON record with any downstream plots or reported conclusions.


## Ensemble analysis

The Research Lab can run independent seeded SSA replicates and report final-population means, sample standard deviations, standard errors and normal-approximation 95% confidence intervals for the ensemble mean. Replicate seeds are derived deterministically from a base seed. Replicates that are cancelled or hit the event cap are not accepted as a completed ensemble. Confidence intervals are descriptive approximations and should not be used without checking distribution shape, sample size and model assumptions.


## Experimental kinetic rate constants

A rate-conversion utility maps macroscopic mass-action constants to the kernel's stochastic propensity convention when the user supplies reaction volume in litres. It assumes an elementary mass-action step, ideal well-mixed solution, constant volume, and a macroscopic rate law of the form r = k Π[Sᵢ]^νᵢ. The converter derives the required order-dependent units and applies the factorial correction for identical reactants. It does not infer physical units, temperature dependence, activities, or mechanisms; users must verify that the supplied k and reaction-order convention match the source experiment. The conversion is a mesoscopic convention whose deterministic correspondence is a large-population limit, not a promise of identical finite-population trajectories.


## Multi-step reaction networks

The Research Lab accepts one neutral reaction equation per line. The parser builds a shared species registry and independent reaction channels, then validates every channel for elemental and formal-charge balance. The UI assigns the same stochastic rate constant to each parsed channel for now; initial populations are configured explicitly per species. Reversible arrows are recognized as metadata, but only the written forward direction is simulated. The macroscopic-rate converter is limited to single-channel networks until per-channel kinetic parameters are supported.


## Temperature-dependent kinetics

The Research Lab includes an Arrhenius calculator for k(T) = A exp(−Ea/RT). Users provide a pre-exponential factor, activation energy in J/mol and temperature in kelvin. The pre-exponential factor carries the same units as the macroscopic rate constant for the selected reaction order. The calculated k(T) can be passed into the volume-aware macroscopic-to-stochastic conversion. This does not infer a mechanism, activation pathway or physically justified Arrhenius parameters.


Experiment JSON exports now also record how the active stochastic rate was obtained: illustrative default, direct stochastic input, macroscopic k-to-c conversion, or Arrhenius k(T) followed by volume-aware conversion. Where applicable, the record includes the original k, volume, reaction order, A, Ea and temperature so the parameter pathway is auditable.


## Per-reaction kinetic parameters

Multi-step networks now have an independent stochastic rate constant for every reaction channel. The macroscopic k converter and Arrhenius-to-k workflow target the selected channel, rather than forcing one kinetic parameter across the entire network. Experiment records use schema `chemistry-lab-experiment/v2` and preserve the rate parameterisation separately for each reaction channel.


## Ionic species and redox equations

Equation input supports explicit caret charge suffixes such as `Fe^3+`, `SO4^2-`, `H^+` and the electron species `e^-`. Charge is stored separately from elemental composition and checked alongside atom conservation. The electron is the only supported atom-free species and carries charge −1. Phase labels, isotope notation, coordination-state inference and structural-isomer identity remain unsupported; specify the relevant species and charges explicitly.


## Exact equation balancing

The Research Lab includes an exact rational row-reduction balancer for neutral and explicitly charged equations. It solves the homogeneous elemental/charge conservation system and returns positive integer stoichiometric coefficients, including electron bookkeeping for redox equations. For underdetermined equations, it searches a bounded set of free-variable assignments and selects the smallest coefficient sum found. It may ask the user to simplify highly underdetermined networks; always inspect the balanced equation and confirm the chemical species before loading it.


Saved v2 JSON experiment records can now be imported back into the Research Lab. Import validation checks the network, populations, per-channel kinetic parameterisation and event-by-event population transitions before restoring the saved trajectory. This catches malformed or internally inconsistent files; it does not certify the scientific correctness of their model assumptions.
