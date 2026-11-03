# External scientific benchmark suite

## Independent numerical simulator

The CI benchmark suite uses SciPy 1.17.0 `solve_ivp` with two separately implemented implicit integrators: BDF and Radau. The pinned scripts regenerate the reference fixtures and compare each solver output to the committed reference values. Chemistry Lab's own fixed-parameter RK4 mass-action simulator is also compared against the independent SciPy BDF trajectory for a non-stiff sequential A → B → C mechanism.

The Robertson (1966) stiff chemical kinetics problem is included as a published stress/reference problem:

- `y1' = -0.04 y1 + 10^4 y2 y3`
- `y2' = 0.04 y1 - 10^4 y2 y3 - 3×10^7 y2²`
- `y3' = 3×10^7 y2²`
- `y(0) = (1, 0, 0)`

BDF and Radau reference trajectories are frozen at logarithmically spaced observation times through 10^5 s. CI checks both solver trajectories, positivity and the conserved total y1+y2+y3=1. The Chemistry Lab fixed-step RK4 solver is deliberately not run on this extremely stiff case: it is not a stiff integrator, and this benchmark records the capability boundary rather than disguising it. The opt-in adaptive implicit solver is validated separately on two synthetic stiff first-order mechanisms.

## Stiff fitting and reversible-network references

The adaptive implicit fitting path is checked on two synthetic mechanisms against SciPy 1.17.0:
- Sequential A→B→C with fast and slow rate scales, fitted with bounded least squares against a BDF trajectory.
- Fast reversible A⇌B relaxation coupled to a slow B→C drain. The trajectory is compared with both BDF and Radau, and all three rate constants are recovered by a separate SciPy BDF + bounded least-squares reference.

The second fixture spans 18 times from the fast transient through the slow drain and checks positivity, total A+B+C conservation, prediction agreement and tolerance refinement. Both are synthetic numerical fixtures, not published chemical mechanisms.

## Independent spatial PDE reference

The 2-D finite-volume diffusion solver is checked against independent SciPy 1.17.0 BDF and Radau method-of-lines references on 8×8, 16×16, 32×32 and 64×64 no-flux grids. A cell-centred cosine eigenmode supplies a closed-form semi-discrete reference; CI compares the TypeScript explicit finite-volume solver directly with that solution, checks BDF/Radau agreement and mass conservation, and gates successive mesh-refinement error ratios. See `docs/SPATIAL_REACTION_DIFFUSION_2D.md`.

## Published kinetics reference data

A separate Arrhenius reference fixture records the NIST Chemical Kinetics Database entry 1992DU/HES1077-1092:1 for H + O2 → OH + O. The NIST record classifies it as an experimental, absolute-rate measurement and supplies the rate expression, temperature range, uncertainty and tabulated k(T) values. Chemistry Lab's Arrhenius implementation is checked against the tabulated values with a tolerance that accounts for NIST's three-significant-figure rounding and its stated gas constant (8.314472 J mol⁻¹ K⁻¹).

Important: NIST labels the tabulated k(T) values as calculated from the displayed Arrhenius expression. They are not raw measured concentration-time trajectories. This check validates the Arrhenius equation implementation against a published experimental evaluation record; it does not validate parameter estimation against raw experimental time-series.

## Reproduction

The GitHub Actions quality workflow installs the pinned SciPy version and runs:

`python scripts/benchmarks/verify_scipy_references.py`

The TypeScript research tests compare the Chemistry Lab sequential-mechanism trajectory with the independent SciPy BDF fixture, validate the NIST Arrhenius table, and compare the 2-D finite-volume solver across four meshes. CI also regenerates the stiff-network BDF/Radau references and the 2-D spatial mesh report.

## Sources

- Robertson, H. H. (1966), “The solution of a set of reaction rate equations,” in *Numerical Analysis: An Introduction*, Academic Press, pp. 178–182. The stiff chemical kinetics test problem is catalogued by the INdAM-Bari Test Set: https://archimede.uniba.it/~testset/problems/rober.php
- SciPy `solve_ivp` documentation: https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.solve_ivp.html
- NIST Chemical Kinetics Database, SRD 17, record 1992DU/HES1077-1092:1: https://kinetics.nist.gov/kinetics/Detail?id=1992DU%2FHES1077-1092%3A1
- ReSpecTh reaction kinetics, spectroscopy and thermochemistry datasets (future experimental dataset expansion): https://www.nature.com/articles/s41597-025-05272-6 and https://osf.io/nbmzv/

## Remaining benchmark gaps

This is a first reproducible external benchmark layer, not comprehensive validation. There is not yet a raw experimental concentration-time dataset with measurement covariance and full mechanism metadata fitted end-to-end. The fixed-step RK4 solver is not validated for stiff systems. The 2-D diffusion operator now has manufactured-solution order studies and an independent SciPy multi-mesh reference. Broader validation is still needed for advection-dominated flows, heterogeneous coefficients, irregular geometries, nonlinear reaction-diffusion and measured spatial datasets. Future benchmark additions should preserve source record identifiers, licensing/attribution, original units, uncertainty metadata, provenance and immutable reference hashes.
