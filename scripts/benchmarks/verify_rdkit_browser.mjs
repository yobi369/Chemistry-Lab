import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const vercelConfig = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
const commonHeaders = Object.fromEntries(vercelConfig.headers[0].headers.map(header => [header.key, header.value]));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let file = pathname === '/' ? path.join(dist, 'index.html') : path.resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + path.sep) && file !== path.join(dist, 'index.html')) {
      response.writeHead(403, commonHeaders).end('Forbidden');
      return;
    }
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(dist, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, {
      ...commonHeaders,
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      ...(pathname === '/sw.js' ? { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' } : {}),
      ...(pathname.startsWith('/vendor/rdkit/') ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {}),
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, commonHeaders).end(String(error));
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://localhost:${address.port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();
const localAssets = new Set();
const cdnRequests = [];
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({url:request.url(),failure:request.failure()?.errorText}));
page.on('request', request => {
  const url = request.url();
  if (url.includes('/vendor/rdkit/')) localAssets.add(new URL(url).pathname);
  if (url.startsWith('https://cdn.jsdelivr.net/npm/@rdkit/rdkit@')) cdnRequests.push(url);
});
page.on('pageerror', error => pageErrors.push(error.message));
await page.addInitScript(() => {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', event => {
    window.__cspViolations.push({ directive: event.effectiveDirective, blockedURI: event.blockedURI });
  });
});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const closeOnboarding = async () => {
    const closeButton = page.getByRole('button', { name: 'Close onboarding tour' });
    if (await closeButton.isVisible().catch(() => false)) {
      for (let step = 0; step < 5; step++) await page.getByRole('button', { name: 'Next Step' }).click();
      await page.getByRole('button', { name: 'Start Exploring' }).click();
    }
  };
  await closeOnboarding();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true,
    'service worker must control the application after the first reload');

  const openResearch = async () => {
    await page.locator('#tab-research').click();
    await page.getByText('RDKit molecular identity & stereochemistry').scrollIntoViewIfNeeded();
  };
  const analyze = async () => {
    await page.getByRole('button', { name: 'Validate & identify molecule' }).click();
    try {
      await page.getByText(/InChI=1S\//).waitFor({ timeout: 15000 });
    } catch (error) {
      const alert = await page.getByRole('alert').textContent().catch(() => 'No visible RDKit error message.');
      const csp = await page.evaluate(() => window.__cspViolations);
      throw new Error(`RDKit browser analysis did not complete. UI error: ${alert}; CSP: ${JSON.stringify(csp)}; console: ${JSON.stringify(consoleErrors)}; failed requests: ${JSON.stringify(failedRequests)}; cause: ${error.message}`);
    }
  };

  await openResearch();
  await analyze();
  assert.ok([...localAssets].some(asset => asset.endsWith('/RDKit_minimal.js')), 'local RDKit JavaScript must load');
  assert.ok([...localAssets].some(asset => asset.endsWith('.wasm')), 'local RDKit WebAssembly must load');
  assert.equal(cdnRequests.length, 0, 'normal production path must not need the CDN fallback');
  const cspViolations = await page.evaluate(() => window.__cspViolations);
  assert.deepEqual(cspViolations, [], 'CSP must allow the app, local WASM and required assets');
  assert.deepEqual(pageErrors, [], 'application must not raise uncaught browser errors');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('Artificial Chemistry Engine').waitFor({ timeout: 15000 });
  await openResearch();
  await analyze();
  assert.deepEqual(pageErrors, [], 'offline reload and RDKit analysis must not raise uncaught browser errors');

  console.log(JSON.stringify({
    browser: 'Chromium',
    csp: 'passed',
    serviceWorkerControlled: true,
    localRdkitAssets: [...localAssets],
    cdnFallbackRequests: cdnRequests.length,
    offlineReloadAndAnalysis: 'passed',
    pageErrors,
    consoleErrors,
    failedRequests,
  }, null, 2));
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
