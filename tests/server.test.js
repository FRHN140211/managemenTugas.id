import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(projectDirectory, 'server.js');

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(child, url) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('The local server exited before it became ready.');
    try {
      const response = await fetch(url);
      if (response.status) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 75));
    }
  }
  throw new Error('The local server did not become ready within 8 seconds.');
}

test('local Express serves the app, restricts static files, and returns API errors as JSON', {
  timeout: 15000
}, async (t) => {
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    PORT: String(port),
    NODE_ENV: 'test',
    DATABASE_URL: 'https://example.invalid/not-a-postgres-database',
    NEON_AUTH_BASE_URL: 'not-a-valid-auth-url'
  };
  const server = spawn(process.execPath, [serverFile], {
    cwd: projectDirectory,
    env,
    stdio: ['ignore', 'ignore', 'ignore']
  });
  t.after(() => {
    if (server.exitCode === null) server.kill();
  });

  await waitForServer(server, baseUrl);

  const homepage = await fetch(baseUrl + '/');
  assert.equal(homepage.status, 200);
  assert.match(homepage.headers.get('content-type'), /text\/html/);
  assert.match(await homepage.text(), /Masuk ke akun Anda/);

  assert.equal(homepage.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(homepage.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(homepage.headers.get('permissions-policy'), /geolocation=\(\)/);
  assert.match(homepage.headers.get('content-security-policy'), /default-src 'self'/);

  const stylesheet = await fetch(baseUrl + '/assets/css/styles.css');
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);

  const offlinePage = await fetch(baseUrl + '/offline.html');
  assert.equal(offlinePage.status, 200);
  assert.match(await offlinePage.text(), /offline-plug\.png/);

  const offlineIcon = await fetch(baseUrl + '/assets/icons/offline-plug.png');
  assert.equal(offlineIcon.status, 200);
  assert.match(offlineIcon.headers.get('content-type'), /image\/png/);

  const serviceWorker = await fetch(baseUrl + '/assets/js/service-worker.js');
  assert.equal(serviceWorker.status, 200);
  assert.equal(serviceWorker.headers.get('service-worker-allowed'), '/');
  assert.match(await serviceWorker.text(), /\/assets\/icons\/offline-plug\.png/);

  const alias = await fetch(baseUrl + '/dashboard.html');
  assert.equal(alias.status, 200);
  assert.match(await alias.text(), /index\.html#\/dashboard/);

  for (const file of ['/server.js', '/database/schema.sql', '/.env.local']) {
    assert.equal((await fetch(baseUrl + file)).status, 404, file);
  }
  assert.equal((await fetch(baseUrl + '/missing-page')).status, 404);
  const deepLink = await fetch(baseUrl + '/profile', {
    headers: { Accept: 'text/html' }
  });
  assert.equal(deepLink.status, 200);
  assert.match(await deepLink.text(), /id="session-loading"/);
  assert.equal((await fetch(baseUrl + '/assets/missing.css', {
    headers: { Accept: 'text/html' }
  })).status, 404);

  for (const endpoint of ['/api/test-db', '/api/not-a-route']) {
    const response = await fetch(baseUrl + endpoint);
    assert.equal(response.status, 404, endpoint);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  }

  const authProxy = await fetch(baseUrl + '/api/neon-auth/get-session');
  assert.equal(authProxy.status, 503);
  assert.equal((await authProxy.json()).error.code, 'AUTH_NOT_CONFIGURED');

  const health = await fetch(baseUrl + '/api/health');
  assert.equal(health.status, 503);
  assert.deepEqual(await health.json(), {
    ok: false,
    code: 'DATABASE_URL_INVALID',
    error: 'DATABASE_URL is invalid; a PostgreSQL connection URL is required.'
  });

  const malformedJson = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });
  assert.equal(malformedJson.status, 400);
  assert.equal((await malformedJson.json()).error.code, 'INVALID_REQUEST');

  const options = await fetch(baseUrl + '/api/tasks', { method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.equal(await options.text(), '');
});
