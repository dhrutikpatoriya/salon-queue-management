import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
delete process.env.SALON_PERSISTENCE_TEST_DIR;
const password = () => 'Aa-' + randomBytes(20).toString('hex');
const original = { owner: password(), reception: password(), ravi: password(), amit: password(), imran: password() };
const next = { reception: password(), ravi: password(), owner: password() };
process.env.OWNER_PASSWORD = original.owner;
process.env.STAFF_PIN = original.reception;
process.env.BARBER_CREDENTIALS = JSON.stringify({ ravi: original.ravi, amit: original.amit, imran: original.imran });

test('owner-managed credentials on isolated SQLite', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T06:00:00Z') });
  const { db } = await import('../db/database.js');
  assert.equal(db.memory, true);
  const { app } = await import('../app.js');
  const { bootstrapCredentials } = await import('../services/credentialService.js');
  const { initializeCredentialSchema } = await import('../db/credentialSchema.js');
  const server = createServer(app);
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.close();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  async function api(path: string, method = 'GET', payload?: object, token?: string) {
    const response = await fetch(address + path, {
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, cache: response.headers.get('cache-control'),
      body: response.status === 204 ? null : await response.json() };
  }
  const ownerLogin = (value: string) => api('/admin/login', 'POST', { password: value });
  const staffLogin = (value: string) => api('/reception/login', 'POST', { pin: value });
  const barberLogin = (barber: string, value: string) => api(`/barber/${barber}/login`, 'POST', { credential: value });
  let owner: string;
  let staff: string;
  let ravi: string;
  let amit: string;
  const change = (id: string, credential: string, token = owner, currentOwnerPassword = original.owner, confirmation = credential) =>
    api(`/admin/credentials/${encodeURIComponent(id)}`, 'PATCH', { currentOwnerPassword, credential, confirmation }, token);

  await t.test('legacy login, non-destructive hash migration, unique salts and idempotence', async () => {
    const legacy = await ownerLogin(original.owner);
    assert.equal(legacy.status, 200);
    const queued = await api('/queue/join', 'POST', {
      customerName: 'Credential fixture', phoneNumber: '9000000001', serviceIds: ['haircut'], barberPreference: 'ravi',
    });
    assert.equal(queued.status, 201);
    const snapshot = db.prepare('SELECT * FROM queue_entries').all();
    const settings = db.prepare('SELECT * FROM salon_settings').all();
    const prior = process.env.BARBER_CREDENTIALS!;
    process.env.BARBER_CREDENTIALS = '{}';
    try {
      await assert.rejects(bootstrapCredentials(), /bootstrapCredentialUnavailable/);
      assert.equal(db.prepare('SELECT count(*) AS count FROM account_credentials').pluck().get(), 0);
    } finally { process.env.BARBER_CREDENTIALS = prior; }
    assert.equal(await bootstrapCredentials(), 5);
    initializeCredentialSchema();
    assert.equal(await bootstrapCredentials(), 0);
    assert.deepEqual(db.prepare('SELECT * FROM queue_entries').all(), snapshot);
    assert.deepEqual(db.prepare('SELECT * FROM salon_settings').all(), settings);
    const hashes = db.prepare('SELECT password_hash FROM account_credentials').pluck().all() as string[];
    assert.equal(hashes.every((value) => value.startsWith('$argon2id$') && !Object.values(original).includes(value)), true);
    assert.equal(new Set(hashes.map((value) => value.split('$')[4])).size, 5);
    assert.equal((await api('/admin/dashboard', 'GET', undefined, legacy.body.token)).status, 401);
    owner = (await ownerLogin(original.owner)).body.token;
    staff = (await staffLogin(original.reception)).body.token;
    ravi = (await barberLogin('ravi', original.ravi)).body.token;
    amit = (await barberLogin('amit', original.amit)).body.token;
    assert.equal([owner, staff, ravi, amit].every((value) => typeof value === 'string'), true);
  });

  await t.test('an invalid database hash fails closed even with the original environment credential present', async () => {
    const read = db.prepare("SELECT password_hash FROM account_credentials WHERE account_id = 'barber:imran'").pluck();
    const stored = read.get() as string;
    const save = db.prepare("UPDATE account_credentials SET password_hash = ? WHERE account_id = 'barber:imran'");
    save.run('invalid fixture encoding');
    try {
      assert.equal((await barberLogin('imran', original.imran)).status, 401);
    } finally {
      save.run(stored);
    }
  });

  await t.test('owner-only authorization, inline reauthentication, validation, and no-store', async () => {
    for (const token of ['', staff, ravi]) assert.equal((await change('reception', next.reception, token)).status, 401);
    assert.equal((await change('reception', next.reception, owner, password())).status, 403);
    assert.equal((await change('reception', next.reception, owner, original.owner, password())).body.error, 'confirmationMismatch');
    assert.equal((await change('reception', '1234567890')).body.error, 'weakCredential');
    assert.equal((await change('reception', original.ravi)).body.error, 'reusedCredential');
    const malformed = await fetch(address + '/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid',
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await malformed.json(), { error: 'invalidRequest' });
    assert.equal((await api('/admin/credentials/reception?credential=ignored', 'PATCH', {}, owner)).status, 403);
    const dashboard = await api('/admin/dashboard', 'GET', undefined, owner);
    assert.equal(dashboard.cache, 'no-store');
    assert.equal(/password_hash|\$argon2id\$|currentOwnerPassword/.test(JSON.stringify(dashboard.body)), false);
  });

  await t.test('individual changes revoke affected sessions and block current and recent reuse', async () => {
    const secondStaff = (await staffLogin(original.reception)).body.token;
    const replaced = await change('reception', next.reception);
    assert.deepEqual([replaced.status, replaced.cache], [204, 'no-store']);
    for (const token of [staff, secondStaff]) {
      assert.equal((await api('/reception/session', 'GET', undefined, token)).status, 401);
    }
    assert.equal((await staffLogin(original.reception)).status, 401);
    const newStaff = await staffLogin(next.reception);
    assert.deepEqual([newStaff.status, newStaff.cache], [200, 'no-store']);
    assert.equal((await api('/reception/dashboard', 'GET', undefined, newStaff.body.token)).status, 200);
    assert.equal((await change('reception', original.reception)).body.error, 'reusedCredential');
    assert.equal((await change('reception', next.reception)).body.error, 'reusedCredential');
    assert.equal((await api('/barber/ravi/dashboard', 'GET', undefined, ravi)).status, 200);
    t.mock.timers.tick(16 * 60_000);
    assert.equal((await change('barber:ravi', next.ravi)).status, 204);
    assert.equal((await barberLogin('ravi', original.ravi)).status, 401);
    const newRavi = (await barberLogin('ravi', next.ravi)).body.token;
    assert.equal((await api('/barber/ravi/dashboard', 'GET', undefined, ravi)).status, 401);
    assert.equal((await api('/barber/ravi/dashboard', 'GET', undefined, newRavi)).status, 200);
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, newRavi)).status, 403);
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, amit)).status, 200);
    assert.equal((await api('/reception/session', 'GET', undefined, newStaff.body.token)).status, 200);
    assert.equal(await bootstrapCredentials(), 0);
  });

  await t.test('owner change requires current password and revokes every owner session', async () => {
    const secondOwner = (await ownerLogin(original.owner)).body.token;
    assert.equal((await change('owner', next.owner, owner, password())).status, 403);
    assert.equal((await change('owner', next.owner)).status, 204);
    for (const token of [owner, secondOwner]) {
      assert.equal((await api('/admin/dashboard', 'GET', undefined, token)).status, 401);
    }
    assert.equal((await ownerLogin(original.owner)).status, 401);
    const login = await ownerLogin(next.owner);
    assert.equal(login.status, 200);
    owner = login.body.token;
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, amit)).status, 200);
  });

  await t.test('rate limits apply to parallel login and credential reauthentication attempts', async () => {
    t.mock.timers.tick(16 * 60_000);
    const logins = await Promise.all(Array.from({ length: 6 }, () => ownerLogin(password())));
    assert.deepEqual(logins.map(({ status }) => status).sort(), [401, 401, 401, 401, 401, 429]);
    const changes = await Promise.all(Array.from({ length: 11 }, () => change('reception', password(), owner, password())));
    assert.equal(changes.filter(({ status }) => status === 403).length, 10);
    assert.equal(changes.filter(({ status }) => status === 429).length, 1);
  });
});

test('bootstrap and a changed Argon2id credential survive process restart on a disposable SQLite file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'salon-persistence-'));
  const env = { ...process.env, SALON_PERSISTENCE_TEST_DIR: directory, SALON_FIXTURE_NEW_PIN: next.reception, SALON_FIXTURE_BARBER_PINS: JSON.stringify({ ravi: password(), amit: password(), imran: password() }) };
  const bootstrap = new URL('../scripts/bootstrapCredentials.js', import.meta.url);
  const service = new URL('../services/credentialService.js', import.meta.url).href;
  const dbModule = new URL('../db/database.js', import.meta.url).href;
  const preamble = `import assert from 'node:assert/strict';
    import { verifyAccount, changeAccountCredential } from ${JSON.stringify(service)};
    import { db } from ${JSON.stringify(dbModule)};
    assert.equal(db.memory, false);`;
  function run(args: string[]) {
    const result = spawnSync(process.execPath, args, { env, timeout: 15000, encoding: 'utf8' });
    assert.equal(result.status, 0, 'Isolated credential process failed');
  }
  try {
    run([fileURLToPath(bootstrap)]);
    run(['--input-type=module', '-e', `${preamble}
      const owner = await verifyAccount('owner', process.env.OWNER_PASSWORD);
      assert.equal(owner.status, 'valid');
      await changeAccountCredential('reception', process.env.SALON_FIXTURE_NEW_PIN,
        process.env.SALON_FIXTURE_NEW_PIN, owner.version, () => true);
      for (const [id, pin] of Object.entries(JSON.parse(process.env.SALON_FIXTURE_BARBER_PINS))) {
        await changeAccountCredential('barber:' + id, pin, pin, owner.version, () => true);
      }
      db.close();`]);
    run([fileURLToPath(bootstrap)]);
    run(['--input-type=module', '-e', `${preamble}
      const { createServer } = await import('node:http');
      const { app } = await import(${JSON.stringify(new URL('../app.js', import.meta.url).href)});
      const server = createServer(app);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      try {
        const url = 'http://127.0.0.1:' + server.address().port + '/api/reception/login';
        const login = (pin) => fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
        });
        assert.equal((await login(process.env.STAFF_PIN)).status, 401);
        assert.equal((await login(process.env.SALON_FIXTURE_NEW_PIN)).status, 200);
        for (const [id, pin] of Object.entries(JSON.parse(process.env.SALON_FIXTURE_BARBER_PINS))) {
          const path = 'http://127.0.0.1:' + server.address().port + '/api/barber/' + id + '/login';
          const barberLogin = (credential) => fetch(path, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
          });
          assert.equal((await barberLogin(JSON.parse(process.env.BARBER_CREDENTIALS)[id])).status, 401);
          assert.equal((await barberLogin(pin)).status, 200);
        }
      } finally {
        await new Promise((resolve) => server.close(resolve));
        db.close();
      }`]);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
