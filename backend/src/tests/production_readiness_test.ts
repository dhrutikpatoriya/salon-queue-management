import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../index.js', import.meta.url));
const frontendRequire = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const origin = 'https://salon-fixture.invalid';
const foreign = 'https://other-fixture.invalid';
const plain = () => 'Aa-' + randomBytes(20).toString('hex');
const fixtures = { owner: plain(), staff: plain(), ravi: plain(), amit: plain(), imran: plain() };

function environment(overrides: NodeJS.ProcessEnv) {
  return {
    ...process.env,
    NODE_ENV: 'production', RENDER: 'false', RENDER_EXTERNAL_URL: '', PUBLIC_ORIGIN: origin, PORT: '0',
    SALON_PERSISTENCE_TEST_DIR: '', SQLITE_DB_PATH: '', ENABLE_DEV_TEST: 'true',
    BOOTSTRAP_CREDENTIALS: 'false', OWNER_PASSWORD: '', STAFF_PIN: '', BARBER_CREDENTIALS: '',
    ...overrides,
  };
}

test('production refuses missing, unsafe, or unmounted database configuration', () => {
  const temp = mkdtempSync(join(tmpdir(), 'salon-production-'));
  try {
    const path = join(realpathSync(temp), 'salon.db');
    for (const [overrides, error] of [
      [{}, /absolute SQLITE_DB_PATH/],
      [{ SQLITE_DB_PATH: path, PUBLIC_ORIGIN: 'http://localhost' }, /requires one HTTPS origin/],
      [{ SQLITE_DB_PATH: path, RENDER: 'true' }, /persistent disk is not mounted/],
      [{ SQLITE_DB_PATH: path, RENDER: 'true', NODE_ENV: 'development' }, /requires NODE_ENV=production/],
    ] as const) {
      const result = spawnSync(process.execPath, [entry], { env: environment(overrides), encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status, 1);
      assert.match(result.stderr, error);
      assert.equal(existsSync(path), false);
    }
  } finally {
    rmSync(temp, { recursive: true });
  }
});

test('production serves the SPA and live API together and preserves credentials and settings across restart', async (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'salon-production-'));
  const path = join(realpathSync(temp), 'salon.db');
  let processHandle: ChildProcess | undefined;
  async function stop() {
    if (processHandle && processHandle.exitCode === null) {
      const exited = once(processHandle, 'exit');
      processHandle.kill('SIGTERM');
      const timer = setTimeout(() => processHandle?.kill('SIGKILL'), 5000);
      try {
        const [code, signal] = await exited;
        assert.deepEqual([code, signal], [0, null], 'Production shutdown failed');
      } finally {
        clearTimeout(timer);
      }
    }
  }
  t.after(async () => {
    await stop();
    rmSync(temp, { recursive: true });
  });
  const uninitialized = spawnSync(process.execPath, [entry], {
    env: environment({ SQLITE_DB_PATH: path, OWNER_PASSWORD: fixtures.owner }),
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(uninitialized.status, 1);
  assert.match(uninitialized.stderr, /Initialize all production credential hashes/);

  async function start(overrides: NodeJS.ProcessEnv) {
    const child = spawn(process.execPath, [entry], {
      env: environment({ SQLITE_DB_PATH: path, ...overrides }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    processHandle = child;
    child.stderr.resume();
    return new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Production startup timed out')), 8000);
      child.once('exit', (status) => {
        clearTimeout(timer);
        reject(new Error(`Production exited during startup (${status})`));
      });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
        const port = /Listening on port (\d+)/.exec(output)?.[1];
        if (port) {
          clearTimeout(timer);
          resolve('http://127.0.0.1:' + port);
        }
      });
    });
  }

  let base = await start({
    BOOTSTRAP_CREDENTIALS: 'true', OWNER_PASSWORD: fixtures.owner, STAFF_PIN: fixtures.staff,
    BARBER_CREDENTIALS: JSON.stringify({ ravi: fixtures.ravi, amit: fixtures.amit, imran: fixtures.imran }),
  });
  async function request(pathname: string, init?: RequestInit) {
    return fetch(base + pathname, { ...init, signal: AbortSignal.timeout(5000) });
  }
  const login = () => request('/api/admin/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: fixtures.owner }),
  });

  for (const route of ['/', '/join', '/status/test-fixture', '/reception', '/barber/ravi', '/display', '/admin']) {
    const response = await request(route, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.match(await response.text(), /<div id="root"/);
  }
  const html = await (await request('/')).text();
  const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
  assert.ok(asset);
  const bundle = await request(asset);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('cache-control') ?? '', /immutable/);
  assert.equal((await request('/assets/no-such-file.js')).status, 404);
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/admin/dashboard')).status, 401);
  assert.equal((await request('/api/dev/call-customer/unused', { method: 'POST' })).status, 404);
  const missing = await request('/api/unknown', { headers: { Accept: 'text/html' } });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'notFound');
  const rejected = await request('/api/display', { headers: { Origin: foreign } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  assert.equal((await request('/socket.io/?EIO=4&transport=polling', { headers: { Origin: foreign } })).status, 403);
  assert.equal((await request('/socket.io/?EIO=4&transport=polling', { headers: { Origin: origin } })).status, 200);

  const socket = frontendRequire('socket.io-client').io(base, {
    transports: ['websocket'], extraHeaders: { Origin: origin }, reconnection: false, timeout: 3000,
  });
  async function event(name: string) {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing socket event ${name}`)), 4000);
      socket.once(name, (message: unknown) => { clearTimeout(timer); resolve(message); });
    });
  }
  try {
    await event('connect');
    const response = await login();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { token } = await response.json();
    const updated = event('queue:updated');
    assert.equal((await request('/api/admin/settings', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + token, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ openTime: '08:00', closeTime: '22:00', onlineJoiningEnabled: false }),
    })).status, 204);
    assert.deepEqual(Object.keys(await updated as object).sort(), ['timestamp', 'type']);
  } finally {
    socket.disconnect();
  }

  await stop();
  base = await start({});
  assert.equal((await login()).status, 200);
  const settings = await (await request('/api/salon/status')).json();
  assert.deepEqual([settings.openTime, settings.closeTime, settings.onlineJoiningEnabled], ['08:00', '22:00', false]);
  assert.equal(existsSync(path), true);
});
