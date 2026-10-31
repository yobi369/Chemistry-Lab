# Two-dimensional reaction–diffusion and transport

## Model

`simulateReactionDiffusion2D` evolves cell-centred concentrations on a uniform rectangular 2-D grid. For species i,

`∂cᵢ/∂t = Dᵢ(∂²cᵢ/∂x² + ∂²cᵢ/∂y²) − uᵢx ∂cᵢ/∂x − uᵢy ∂cᵢ/∂y + Σᵣ νᵢᵣ kᵣ cⱼ(r)`.

Diffusion uses conservative centred face fluxes; advection uses conservative first-order upwind face fluxes; reaction channels are unimolecular first-order mass-action sources. The state is a row-major grid indexed `[y][x]`.

## Units and boundary conditions

- Width, height and cell widths: m.
- Time and time step: s.
- Diffusion coefficient: m² s⁻¹.
- Velocity components: m s⁻¹.
- Concentration: mol m⁻³.
- First-order rate constants: s⁻¹.

The default boundary condition is impermeable no-flux on all four edges. Periodic boundaries wrap both diffusion and transport fluxes in both dimensions.

## Stability restriction

For cell widths Δx, Δy, maximum diffusion Dmax, maximum velocity components |ux|max and |uy|max, and maximum first-order species out-rate kout,max, the explicit positivity restriction enforced is

`Δt [2Dmax(1/Δx² + 1/Δy²) + |ux|max/Δx + |uy|max/Δy + kout,max] ≤ 1`.

The solver rejects a step outside this bound and rejects non-finite or materially negative concentrations.

## Validation

Tests cover uniform-field preservation, no-flux diffusion conservation, periodic transport and boundary wrapping, invalid/ragged grids, unstable-step rejection, and a manufactured Neumann solution

`c(x,y,t)=1+0.2 cos(πx/Lx) cos(πy/Ly) exp[−Dπ²(1/Lx²+1/Ly²)t]`.

The manufactured-solution test uses mesh refinement with Δt proportional to Δx² and requires approximately second-order overall convergence.

## Limitations

The implementation is a 2-D constant-coefficient explicit Euler solver with first-order upwind advection and first-order reaction channels. It does not implement adaptive/implicit or stiff integration, higher-order transport, nonuniform or unstructured meshes, anisotropic diffusion tensors, heterogeneous media, fluid momentum, electro-migration, reactive interfaces, adsorption, heat coupling, stochastic reaction-diffusion or open-flow boundary conditions. Manufactured-solution convergence is a useful numerical check but not a substitute for an external PDE package comparison or measured spatial data. Application-specific scientific validation remains required.
