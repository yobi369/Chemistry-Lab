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
