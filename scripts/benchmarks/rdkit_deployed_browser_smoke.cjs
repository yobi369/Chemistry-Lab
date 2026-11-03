const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = (process.env.RDKIT_SMOKE_BASE_URL || 'https://chemistry-lab-mocha.vercel.app').replace(/\/$/, '');
const expectedCommit = process.env.EXPECTED_COMMIT_SHA || '';
const timeoutMs = Number(process.env.DEPLOYMENT_WAIT_TIMEOUT_MS || 10 * 60 * 1000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDeployment() {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'No matching build metadata received.';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + '/build-meta.json', { cache: 'no-store' });
      if (response.ok) {
        const metadata = await response.json();
        if (!expectedCommit || metadata.commitSha === expectedCommit) return metadata;
        lastError = 'Deployed commit ' + metadata.commitSha + ' does not match expected ' + expectedCommit;
      } else {
        lastError = 'build-meta.json returned HTTP ' + response.status;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(10000);
  }
  throw new Error('Timed out waiting for the expected Vercel production deployment: ' + lastError);
}

(async () => {
  const metadata = await waitForDeployment();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const responses = [];
  const requests = [];
  const relevantConsoleErrors = [];
  const pageErrors = [];

  page.on('request', request => requests.push(request.url()));
  page.on('response', response => responses.push(response));
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy|Refused to|RDKit|WebAssembly|wasm|service worker|Failed to fetch/i.test(message.text())) {
      relevantConsoleErrors.push(message.text());
    }
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!response || response.status() !== 200) {
      throw new Error('Production application returned HTTP ' + (response ? response.status() : 'no response') + '. The public alias may be protected by SSO.');
    }
    const csp = response.headers()['content-security-policy'] || '';
    if (!csp.includes("'wasm-unsafe-eval'") || !csp.includes("worker-src 'self'") || csp.includes('cdn.jsdelivr.net')) {
      throw new Error('Production CSP is missing required WebAssembly/service-worker directives or still depends on jsDelivr: ' + csp);
    }
    await page.locator('#tab-research').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#tab-research').click();
    await page.getByRole('heading', { name: 'RDKit molecular identity & stereochemistry' }).waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('button', { name: 'Validate & identify molecule' }).click();
    const inchiLocator = page.locator('p').filter({ hasText: /^InChI=1S\// }).first();
    await inchiLocator.waitFor({ state: 'visible', timeout: 60000 });
    const inchi = (await inchiLocator.textContent() || '').trim();
    const inchiKey = (await page.locator('p').filter({ hasText: /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/ }).first().textContent() || '').trim();
    const smiles = (await page.getByText('Canonical isomeric SMILES', { exact: true }).locator('xpath=following-sibling::p[1]').textContent() || '').trim();
    if (!inchi.startsWith('InChI=1S/') || !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchiKey) || !smiles) {
      throw new Error('RDKit returned incomplete identity output: ' + JSON.stringify({ inchi, inchiKey, smiles }));
    }
    await page.getByText('RDKit 2026.9.1', { exact: true }).waitFor({ state: 'visible' });

    const onlineAssets = responses.filter(item => item.url().includes('/vendor/rdkit/2026.9.1/'));
    const jsResponse = onlineAssets.find(item => item.url().endsWith('/RDKit_minimal.js'));
    const wasmResponse = onlineAssets.find(item => item.url().endsWith('/RDKit_minimal.wasm'));
    if (!jsResponse || jsResponse.status() !== 200) throw new Error('Local RDKit JavaScript asset did not load successfully.');
    if (!wasmResponse || wasmResponse.status() !== 200) throw new Error('Local RDKit WebAssembly asset did not load successfully.');
    const wasmType = wasmResponse.headers()['content-type'] || '';
    if (!wasmType.includes('application/wasm')) throw new Error('RDKit WASM MIME type is incorrect: ' + wasmType);
    if (requests.some(url => url.includes('cdn.jsdelivr.net') || url.includes('@rdkit/rdkit'))) {
      throw new Error('The deployed RDKit runtime unexpectedly requested a third-party CDN.');
    }

    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    const cacheState = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      const key = keys.find(value => value.startsWith('chemistry-lab-static-'));
      if (!key) return { cacheName: null, js: false, wasm: false, manifest: false, appShell: false };
      const cache = await caches.open(key);
      return {
        cacheName: key,
        js: !!(await cache.match('/vendor/rdkit/2026.9.1/RDKit_minimal.js')),
        wasm: !!(await cache.match('/vendor/rdkit/2026.9.1/RDKit_minimal.wasm')),
        manifest: !!(await cache.match('/vendor/rdkit/2026.9.1/manifest.json')),
        appShell: !!(await cache.match('/index.html')),
      };
    });
    if (!cacheState.js || !cacheState.wasm || !cacheState.manifest || !cacheState.appShell) {
      throw new Error('Service worker did not precache the app shell and all RDKit assets: ' + JSON.stringify(cacheState));
    }

    const offlineResponseStart = responses.length;
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#tab-research').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#tab-research').click();
    await page.getByRole('button', { name: 'Validate & identify molecule' }).click();
    await page.locator('p').filter({ hasText: /^InChI=1S\// }).first().waitFor({ state: 'visible', timeout: 60000 });
    const offlineResponses = responses.slice(offlineResponseStart);
    const offlineWasm = offlineResponses.find(item => item.url().endsWith('/RDKit_minimal.wasm'));
    const offlineJs = offlineResponses.find(item => item.url().endsWith('/RDKit_minimal.js'));
    if (!offlineWasm || !offlineWasm.fromServiceWorker() || !offlineJs || !offlineJs.fromServiceWorker()) {
      throw new Error('RDKit JS/WASM were not served by the service-worker cache while offline.');
    }
    await context.setOffline(false);

    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: path.join('artifacts', 'rdkit-deployed-browser-smoke.png'), fullPage: true });
    if (pageErrors.length || relevantConsoleErrors.length) {
      throw new Error('Browser errors detected: ' + JSON.stringify({ pageErrors, relevantConsoleErrors }));
    }
    console.log(JSON.stringify({
      status: 'passed',
      deployment: { url: baseUrl, commitSha: metadata.commitSha, rdkitVersion: metadata.rdkitVersion },
      csp: 'same-origin scripts, wasm-unsafe-eval and same-origin service worker',
      online: { inchi, inchiKey, wasmContentType: wasmType, jsStatus: jsResponse.status(), wasmStatus: wasmResponse.status() },
      offline: { serviceWorkerCache: cacheState, wasmFromServiceWorker: offlineWasm.fromServiceWorker(), jsFromServiceWorker: offlineJs.fromServiceWorker() },
      thirdPartyRdkitRequests: 0,
    }, null, 2));
  } catch (error) {
    fs.mkdirSync('artifacts', { recursive: true });
    try { await page.screenshot({ path: path.join('artifacts', 'rdkit-deployed-browser-smoke-failure.png'), fullPage: true }); } catch {}
    console.error(error instanceof Error ? error.stack : String(error));
    if (pageErrors.length || relevantConsoleErrors.length) console.error(JSON.stringify({ pageErrors, relevantConsoleErrors }));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
