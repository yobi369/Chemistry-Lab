# Analytical SSA validation benchmarks

This document records deterministic, analytical reference checks for the well-mixed Gillespie direct-method kernel. These are software-verification benchmarks, not an independent validation of arbitrary chemical mechanisms or physical parameter sets.

## First-order decay: exact finite-population distribution

For the elementary channel A → B with one A molecule consumed per event and stochastic rate constant k, each initially present A molecule survives independently to time t with probability

\[
p(t)=e^{-kt}.
\]

For initial population \(N_0\), the exact survivor distribution is

\[
N_A(t)\sim\operatorname{Binomial}(N_0,p(t)),
\quad
\mathbb E[N_A(t)]=N_0p(t),
\quad
\operatorname{Var}[N_A(t)]=N_0p(t)(1-p(t)).
\]

The automated ensemble benchmark checks both the sample mean and sample variance against these finite-population analytical values over 3,000 independently seeded trajectories. This is stronger than checking only the deterministic mean-field decay curve.

## Competing first-order channels

For A → B with rate c_B and A → C with rate c_C, the total hazard for one A is c_B + c_C. At time t:

\[
P(A\text{ remains})=e^{-(c_B+c_C)t},
\]

\[
P(B\text{ formed})=\frac{c_B}{c_B+c_C}(1-e^{-(c_B+c_C)t}),
\]

\[
P(C\text{ formed})=\frac{c_C}{c_B+c_C}(1-e^{-(c_B+c_C)t}).
\]

The automated test compares ensemble product populations with these branching probabilities and checks the total conversion probability.

## Interpretation and limits

- The tests use fixed seeds so regressions are repeatable; passing does not establish the PRNG's suitability for cryptographic use.
- Statistical acceptance bands are finite-sample tolerances, not proofs. A failure can arise from a real implementation regression or from a changed random stream and should be investigated rather than hidden by widening tolerances.
- The benchmarks cover well-mixed, constant-volume, memoryless first-order channels. They do not validate diffusion, transport, non-Markovian kinetics, reversible thermodynamic equilibrium, non-elementary empirical rate laws, or a chemically complete mechanism.
- These tests do not replace comparison against an independent trusted SSA implementation or published experimental datasets.

## Run

```bash
npm test
npm run typecheck
npm run build
```
