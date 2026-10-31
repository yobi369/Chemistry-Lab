# Detailed-balance constrained reversible kinetics

## Thermodynamic constraint

For a reaction written forward with dimensionless activities,

`Q = Πᵢ aᵢ^(νᵢ)` and `K° = exp(−ΔᵣG°/(RT))`.

The reversible mass-action fluxes are `v_f = k_f Π_reactants aᵢ^αᵢ` and `v_r = k_r Π_products aᵢ^βᵢ`. Detailed balance requires equality at equilibrium Q=K°, therefore `k_f/k_r = K°` and the reverse coefficient is derived, never independently guessed: `k_r = k_f/K°`.

The module computes ΔᵣG° from supplied species standard Gibbs formation energies, derives K° and kᵣ, and validates supplied equilibrium activities by checking both log(Q/K) and forward/reverse flux agreement.

## Reversible ODE model

The included deterministic model evolves dimensionless activities:

`daᵢ/dt = Σᵣ (βᵢᵣ−αᵢᵣ)(k_f,r Π a^α − k_r,r Π a^β)`.

Because activities are dimensionless, the model's forward/reverse coefficients have units s⁻¹. All species must share a consistent standard-state convention. This is an ideal-activity, well-mixed model. It is not a general concentration-unit kinetics interface; non-ideal activity coefficients must be supplied by a future thermodynamic model rather than assumed to be one.

## Validation

Tests check a thermodynamic equilibrium constant of 4, derive the reverse coefficient from the forward coefficient, verify equal forward/reverse flux at Q=K, and simulate relaxation from an off-equilibrium initial state to the analytic two-state equilibrium while conserving total activity.

## Limitations

- Standard Gibbs formation energies and activities are user-supplied; data provenance and standard-state conventions must be independently established.
- Ideal activities only; no activity coefficients, phases, pressure corrections, electrochemical potentials or temperature-dependent heat-capacity corrections.
- Fixed-step RK4 is not a stiff solver and can require small steps.
- The current solver does not perform a general cycle-space analysis or prove detailed balance for arbitrary externally supplied independently fitted forward/reverse rate sets; reverse rates are derived from the same thermodynamic state data, ensuring cycle thermodynamic consistency when species formation energies are shared.
- This model does not yet connect to the existing stochastic SSA or spatial solver.
