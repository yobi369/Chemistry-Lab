# RDKit cheminformatics integration

## Toolkit and runtime

Chemistry Lab integrates the official RDKit.js MinimalLib WebAssembly distribution, pinned to RDKit 2026.9.1. The browser lazily loads the JavaScript glue and WASM binary from jsDelivr on first molecular analysis. SMILES and molecule data are processed in the browser; they are not submitted to a Chemistry Lab backend or third-party conversion API.

The adapter calls RDKit molecule parsing with sanitization enabled, then requests canonical isomeric SMILES, standard InChI, InChIKey, descriptors, atom/bond counts and RDKit JSON. The JSON preserves RDKit atom and bond properties, including stereo annotations. The toolkit's sanitization performs RDKit chemistry checks (including valence/sanitization checks); invalid structures fail rather than falling back to the project's hand-written graph checks. The WASM molecule is deleted in a `finally` block.

## InChI feature gate

InChI support is compiled conditionally in RDKit MinimalLib. The adapter feature-detects `get_inchi` and fails closed if the published WASM package does not expose it. It never fabricates an InChI or substitutes an identifier from a heuristic. The actual production build must pass the browser smoke test for InChI generation before this capability is treated as deployed.

## Stereochemistry and isomers

Canonical isomeric SMILES and standard InChI/InChIKey are used to preserve supported stereochemical distinctions and identify constitutional/stereochemical isomers. Raw RDKit JSON is retained for audit and inspection. RDKit's supported stereo model has documented limits: tetrahedral and cis/trans stereochemistry are fully supported; non-tetrahedral stereochemistry remains partial/evolving. A missing stereo specification is not evidence that a stereocentre is achiral.

## Operational constraints

- The pinned runtime is downloaded from jsDelivr at first use; first-use analysis therefore requires network access and a compatible content-security policy.
- The package version is pinned in source, but the JS/WASM assets are not vendored into this repository. For air-gapped or high-assurance deployments, vendor and hash-verify the exact release assets.
- InChI generation depends on InChI support being present in the distributed WASM build; the adapter explicitly checks this.
- The UI displays raw RDKit JSON and descriptors for inspection; no atom mapping or stereo labels are inferred by Chemistry Lab itself.
- The existing hand-written atom/bond graph validator remains useful for simple graph consistency but is not a substitute for RDKit sanitization.

## Tests and validation

Adapter tests use a controlled RDKit interface double to verify input bounds, canonical identity handling, InChIKey validation, failure behaviour and memory release. These are adapter contract tests, not a substitute for an actual browser/WASM smoke test. The browser integration must be exercised against the pinned package and known reference molecules (including enantiomer pairs and structural isomers) before production certification.
