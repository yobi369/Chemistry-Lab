# RDKit deployment, CSP and offline-runtime validation

## Deployment contract

The production build stages the exact `@rdkit/rdkit@2026.9.1` MinimalLib JavaScript and WASM files into `public/vendor/rdkit/` before Vite builds `dist/`. The package is installed in CI and by the Vercel build command; it is not added to the browser bundle as a remote script dependency. The asset-copy script fails closed in CI/Vercel if the pinned package or expected WASM files are missing.

The browser adapter sends SMILES to a same-origin dedicated worker. That worker loads `/vendor/rdkit/2026.9.1/RDKit_minimal.js` first and resolves the WASM file against the same-origin asset directory. The worker keeps RDKit's required dynamic Embind code generation outside the main application context. It checks the actual runtime version. A pinned jsDelivr URL is retained as a recovery path if local assets are missing or fail to initialize; normal production operation should not request the CDN.

## Content Security Policy

`vercel.json` applies a CSP and baseline response headers. The CSP:
- Restricts default resources to same origin.
- Allows WebAssembly compilation with `'wasm-unsafe-eval'` without enabling general JavaScript `'unsafe-eval'`.
- Allows the pinned jsDelivr fallback in `script-src` and `connect-src`.
- Allows the Google Fonts stylesheet/font origins already used by the app.
- Allows the Vercel preview feedback script and its same-origin WebSocket/API connections.
- Restricts object embedding, form submission, frame ancestors, and worker origins.

The dedicated `/rdkit-worker.js` script is served with its own CSP and `Cache-Control: no-cache`. The service worker is served with `Cache-Control: no-cache` and `Service-Worker-Allowed: /`. Local RDKit files receive long-lived immutable caching because the RDKit version is pinned and changed assets are deployed with a new build.

## Offline behavior

`public/sw.js` caches the application shell, hashed Vite assets and same-origin RDKit files. After the first successful online load and RDKit initialization, a subsequent offline reload can use the cached application and WASM runtime. A first-ever visit while offline is not supported: the browser must initially download the app and its static assets.

The service worker uses cache-first behavior for hashed assets and RDKit runtime files. The root document is cached as the offline shell. Cache names are versioned and old application caches are removed during service-worker activation.

## Automated validation

CI installs Chromium and runs `scripts/benchmarks/verify_rdkit_browser.mjs` against the built static output, served with the exact response headers from `vercel.json`. It verifies:
1. The service worker controls the app after activation/reload.
2. The Research Lab molecular toolkit loads and identifies the default stereochemical reference molecule.
3. RDKit JavaScript and WASM are requested from same-origin `/vendor/rdkit/2026.9.1/` paths, not the CDN.
4. No Content Security Policy violations or uncaught browser errors occur.
5. A browser offline reload still loads the app and performs RDKit analysis using cached assets.

A separate local asset integrity check validates the RDKit manifest, file presence and WebAssembly magic bytes. The Node runtime smoke test continues to validate canonical SMILES, InChI, InChIKey, stereochemistry, isomer distinction and invalid valence against the pinned package.

## Observed Vercel preview HTTP validation

The latest Vercel preview for this branch reached `READY` at deployment `dpl_HQzigXtu8ciSGxVHuNoEUEFSyizF` (commit `ec30857295097c9888b9169dd19bb5c7dd9cddbd`). Authenticated deployment fetches returned HTTP 200 for the application root, `/sw.js`, `/vendor/rdkit/2026.9.1/manifest.json`, `/vendor/rdkit/2026.9.1/RDKit_minimal.js`, and `/vendor/rdkit/2026.9.1/RDKit_minimal.wasm`.

Observed response properties:
- The root document returns the configured Content-Security-Policy, including `'wasm-unsafe-eval'`, same-origin scripts, the pinned CDN fallback, Google Fonts, and Vercel preview feedback origins.
- Baseline security headers are present: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict-origin referrer policy, and a restrictive Permissions Policy. Vercel supplies HSTS.
- `/sw.js` returns `Cache-Control: no-cache` and `Service-Worker-Allowed: /`.
- The manifest reports RDKit.js 2026.9.1 and lists the MinimalLib JS and WASM assets.
- The JavaScript asset returns `application/javascript`; the WASM asset returns `application/wasm`. Both receive `public, max-age=31536000, immutable`.

These are deployed HTTP/header/asset checks. The Chromium CSP and offline reload test in CI is the browser execution gate; it runs against the exact Vite build output and CSP values. The protected Vercel preview itself remains behind Vercel Authentication and was not made public for automated testing.

## Vercel project protection and release status

The `chemistry-lab` Vercel project is linked to `yobi369/Chemistry-Lab`, uses the Vite framework and builds to `dist`. All deployment URLs, including custom domains, are protected by Vercel Authentication (`all`); no public preview or production access was enabled to make testing easier. The Vercel build command installs the pinned RDKit package before running `bun run build`.

A successful GitHub browser test validates the production build and CSP contract locally. The Vercel preview must additionally be checked for READY status, the actual CSP/security response headers, and successful retrieval of `/sw.js`, `/vendor/rdkit/RDKit_minimal.js`, and the WASM asset before this stage is marked complete. The protected preview is accessed through the authenticated Vercel deployment integration; protection is not disabled for validation.
