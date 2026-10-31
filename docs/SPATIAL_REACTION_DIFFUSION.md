# Spatial reaction–diffusion and transport kernel (1-D)

## Model and units

`simulateReactionDiffusion1D` is a deterministic cell-centred finite-volume solver for

`∂cᵢ/∂t = Dᵢ ∂²cᵢ/∂x² − uᵢ ∂cᵢ/∂x + Σᵣ νᵢᵣ kᵣ cⱼ(r)`

with:
- Domain length and cell width: m.
- Time and time step: s.
- Diffusion coefficient: m² s⁻¹.
- Constant transport velocity: m s⁻¹.
- Concentration: mol m⁻³.
- First-order rate constant: s⁻¹.

Diffusion uses conservative centred face fluxes. Advection uses a conservative first-order upwind flux. Reactions are explicit first-order unimolecular mass-action source terms. Diffusion, transport and reaction source terms are evaluated from the same old-time state in an explicit Euler step.

## Boundary conditions

- `no-flux` is the default. Diffusive and advective boundary-face fluxes are zero at both ends (impermeable walls).
- `periodic` wraps both diffusion and advection face fluxes across the domain endpoints. This is suitable for periodic transport benchmarks, not open-flow inlet/outlet conditions.

## Numerical stability and positivity

For cell width Δx, time step Δt, maximum diffusion coefficient Dmax, maximum absolute velocity umax, and maximum total first-order out-rate kout,max, the implementation enforces the conservative combined explicit restriction

`Δt (2 Dmax / Δx² + umax / Δx + kout,max) ≤ 1`.

An unstable step is rejected. The implementation also rejects non-finite or materially negative states; tiny negative round-off values within tolerance are clamped to zero. This is an explicit first-order time integrator with first-order upwind advection, not an adaptive or implicit solver.

## Numerical validation included

- No-flux diffusion conserves the spatially integrated concentration and smooths a pulse.
- A uniform concentration field remains uniform under diffusion.
- First-order conversion is checked against its explicit-Euler recurrence.
- Periodic upwind transport moves a pulse in the expected direction, wraps across the boundary and conserves the spatial sum.
- A manufactured Neumann solution, `c(x,t)=1+0.2 cos(πx/L) exp(−D(π/L)²t)`, is checked on successively refined meshes. With Δt proportional to Δx², the test requires approximately second-order overall refinement behaviour.

## Limitations

This solver is one-dimensional, deterministic, constant-coefficient and explicit. It does not implement multi-dimensional geometry, adaptive or implicit/stiff integration, high-order advection, dispersion tensors, heterogeneous media, reactive interfaces, adsorption, electro-migration, fluid momentum, variable density, temperature coupling, stochastic reaction-diffusion, or open-flow inlet/outlet boundary conditions.

The manufactured-solution test verifies a smooth diffusion eigenmode and mesh/time refinement trend; it is not a substitute for comparison against a separately maintained PDE package, measured spatial concentration fields, or a broader manufactured-solution suite. The reaction model is limited to first-order channels. Quantitative research use still requires independent external PDE validation and application-specific model verification.
