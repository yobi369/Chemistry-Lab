# Spatial reaction–diffusion kernel (1-D)

## Scope

`simulateReactionDiffusion1D` is a deterministic, cell-centred finite-volume solver for a one-dimensional domain. It couples Fickian diffusion to explicitly declared unimolecular mass-action channels. It is intentionally separate from the visual particle sandbox and the well-mixed stochastic SSA.

## Units and equations

- Domain length and cell width: m.
- Time and time step: s.
- Diffusion coefficient: m² s⁻¹.
- Concentration: mol m⁻³.
- First-order rate constant: s⁻¹.

For species i, the continuum model is

`∂cᵢ/∂t = Dᵢ ∂²cᵢ/∂x² + Σᵣ νᵢᵣ kᵣ cⱼ(r)`

where each reaction r has exactly one first-order reactant j(r), and νᵢᵣ is its product-minus-reactant stoichiometric contribution. The implementation uses explicit Euler time stepping and conservative face fluxes. Both domain boundaries have zero normal diffusive flux (Neumann/no-flux).

## Numerical restriction

For cell width Δx and time step Δt, the implementation enforces the sufficient explicit positivity/stability bound

`Δt (2 Dmax / Δx² + kout,max) ≤ 1`

where kout,max is the largest sum of first-order rate constants leaving any one species. Users must refine Δx and reduce Δt together. The code rejects a step outside this bound rather than silently clipping an unstable trajectory. Small negative round-off values within tolerance are clamped to zero.

## Validation included

Tests cover conservation of the spatial sum under no-flux diffusion, smoothing of a concentration pulse, preservation of a uniform field, first-order conversion against the explicit-Euler closed-form recurrence, non-negativity and rejection of an unstable time step.

## Not yet validated / limitations

This first solver is 1-D, deterministic, explicit and limited to unimolecular reactions. It does not implement advection, hydrodynamic transport, heterogeneous media, interfaces, adsorption, electro-migration, stochastic reaction-diffusion, adaptive time stepping, implicit solvers, 2-D/3-D geometry or coupled temperature fields. It has not yet been compared with a manufactured-solution convergence suite or an external PDE package. The stability bound is a conservative explicit-step restriction, not evidence of physical model validity. Independent mesh/time refinement and external reference comparisons remain required before quantitative research use.
