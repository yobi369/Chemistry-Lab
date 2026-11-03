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

Unit tests cover:
- Uniform-field preservation under periodic diffusion and transport.
- No-flux diffusion conservation and non-negativity.
- Periodic transport and boundary wrapping.
- Invalid and ragged grid rejection.
- Explicit stability-bound enforcement.
- Manufactured Neumann cosine-mode mesh refinement.

The manufactured continuum solution is

`c(x,y,t)=1+0.2 cos(πx/Lx) cos(πy/Ly) exp[−Dπ²(1/Lx²+1/Ly²)t]`.

Its mesh-refinement test uses Δt proportional to Δx² and requires approximately second-order overall convergence.

## Independent SciPy BDF/Radau comparison

CI independently validates the finite-volume diffusion operator against SciPy 1.17.0 `solve_ivp` BDF and Radau references.

### Single-grid reference

An 8×8 cell-centred no-flux diffusion case is checked against frozen BDF and Radau reference arrays. The TypeScript solver is compared at every cell and final time; the two SciPy trajectories must agree within the pinned tolerance.

### Four-mesh convergence experiment

A second benchmark uses a 1 m × 1 m domain, D = 0.1 m² s⁻¹ and the cell-centred initial mode

`c(x,y,0)=1+0.2 cos(πx) cos(πy)`.

SciPy BDF and Radau independently integrate the sparse method-of-lines operator on 8×8, 16×16, 32×32 and 64×64 grids. The TypeScript explicit finite-volume solver is then compared with the exact semi-discrete cosine eigenmode, which is also the closed-form solution of that method-of-lines ODE. The benchmark checks:
- Direct maximum-error comparison with the semi-discrete reference on every mesh.
- BDF/Radau agreement below 3×10⁻⁹.
- Conservation of the spatial sum for no-flux diffusion.
- Successive mesh-refinement error ratios above 3.7, consistent with approximately second-order spatial convergence.

The pinned reference is `benchmarks/spatial2d_mesh_convergence_scipy.json`; the independent SciPy verifier is `scripts/benchmarks/verify_spatial2d_mesh_convergence.py`. CI archives the recomputed report as `spatial2d-scipy-mesh-convergence`.

This validates a specific smooth constant-coefficient no-flux diffusion mode and the corresponding finite-volume operator. It is stronger than a single-grid comparison but is not a general PDE certification.

## Limitations

The implementation is a 2-D constant-coefficient explicit Euler solver with first-order upwind advection and first-order reaction channels. It does not implement adaptive/implicit or stiff integration, higher-order transport, nonuniform or unstructured meshes, anisotropic diffusion tensors, heterogeneous media, fluid momentum, electro-migration, reactive interfaces, adsorption, heat coupling, stochastic reaction-diffusion or open-flow boundary conditions. Advection-dominated regimes, nonlinear reaction networks, irregular geometries and measured spatial datasets still need independent validation. Application-specific scientific validation remains required.
