import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
const credentials = {
  ravi: randomBytes(16).toString('hex'),
  amit: randomBytes(16).toString('hex'),
};
const staffPin = randomBytes(16).toString('hex');
process.env.BARBER_CREDENTIALS = JSON.stringify(credentials);
process.env.STAFF_PIN = staffPin;

test('Step 5 Barber and TV', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T06:00:00Z') });
  const { db } = await import('../db/database.js');
  assert.equal(db.memory, true);
  t.after(() => db.close());
  const { app } = await import('../app.js');
  const { setupSocketIO } = await import('../socket/socketHandler.js');
  const server = createServer(app);
  const io = setupSocketIO(server);
  t.after(() => io.close());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function api(path: string, method = 'GET', body?: object, token?: string) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }

  // Use the same installed Socket.IO client as the frontend.
  const frontendRequire = createRequire(new URL('../../../frontend/package.json', import.meta.url));
  const socket = frontendRequire('socket.io-client').io(base, { autoConnect: false, reconnectionDelay: 20, randomizationFactor: 0 });
  t.after(() => socket.disconnect());
  function event(name: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(name, listener);
        reject(new Error(`Timed out waiting for ${name}`));
      }, 3000);
      function listener(value: unknown) {
        clearTimeout(timeout);
        resolve(value);
      }
      socket.once(name, listener);
    });
  }

  function login(name: string, credential: string) {
    return api(`/barber/${name}/login`, 'POST', { credential });
  }
  const staff = (await api('/reception/login', 'POST', { pin: staffPin })).body.token;
  const ravi = (await login('Ravi', credentials.ravi)).body.token;
  const amit = (await login('amit', credentials.amit)).body.token;

  await t.test('individual credentials, missing and shared configuration, scoped access, and logout', async () => {
    assert.match(ravi, /^[a-f0-9]{64}$/);
    assert.match(amit, /^[a-f0-9]{64}$/);
    assert.equal((await login('Ravi', credentials.amit)).status, 401);
    assert.equal((await login('Imran', credentials.ravi)).status, 503);
    assert.equal((await login('Unknown', credentials.ravi)).status, 404);
    process.env.BARBER_CREDENTIALS = JSON.stringify({ ravi: credentials.ravi, amit: credentials.ravi });
    try {
      assert.equal((await login('ravi', credentials.ravi)).status, 503);
    } finally {
      process.env.BARBER_CREDENTIALS = JSON.stringify(credentials);
    }
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, ravi)).status, 403);
    assert.equal((await api('/barber/ravi/dashboard', 'GET', undefined, staff)).status, 401);
    const extra = (await login('amit', credentials.amit)).body.token;
    assert.equal((await api('/barber/amit/logout', 'POST', undefined, extra)).status, 204);
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, extra)).status, 401);
  });

  const ids: string[] = [];
  const customerName = 'Private fixture customer';
  for (const [index, barberPreference] of ['ravi', 'imran', 'any', 'amit', 'ravi', 'any', 'any'].entries()) {
    const walkIn = await api('/reception/walk-in', 'POST', {
      customerName, phoneNumber: `900000000${index}`, barberPreference, serviceIds: ['haircut'],
    }, staff);
    assert.equal(walkIn.status, 201);
    ids.push(walkIn.body.ticket.id);
  }

  await t.test('TV keeps the earliest five Waiting tokens and returns a public-only payload', async () => {
    assert.equal((await api('/barber/ravi/availability', 'PATCH', { status: 'break' }, ravi)).status, 204);
    db.prepare("UPDATE barbers SET is_on_duty = 0 WHERE id = 'imran'").run();
    const display = await api('/display');
    assert.equal(display.status, 200);
    assert.deepEqual(Object.keys(display.body).sort(), ['barbers', 'date', 'salonOpen', 'waiting']);
    assert.deepEqual(display.body.waiting.map((row: { token: string }) => row.token), ['S-1', 'S-2', 'S-3', 'S-4', 'S-5']);
    assert.equal(display.body.waiting[0].approxWaitMinutes, null);
    assert.equal(display.body.waiting[1].approxWaitMinutes, null);
    for (const row of display.body.waiting) assert.deepEqual(Object.keys(row).sort(), ['approxWaitMinutes', 'token']);
    for (const row of display.body.barbers) assert.deepEqual(Object.keys(row).sort(), ['name', 'status', 'token']);
    assert.equal(display.body.barbers.some((row: { name: string }) => row.name === 'Imran'), false);
    for (const privateValue of [...ids, customerName, '9000000000', ravi, amit]) {
      assert.equal(JSON.stringify(display.body).includes(privateValue), false);
    }
    assert.equal((await api('/reception/call-next', 'POST', { barberId: 'ravi' }, staff)).status, 400);
    assert.equal((await api('/barber/ravi/availability', 'PATCH', { status: 'available' }, ravi)).status, 204);
  });

  await t.test('Call, Start, and Done broadcast updates, with scoped actions and atomic transitions', async () => {
    const connected = event('connect');
    socket.connect();
    await connected;
    const callEvent = event('queue:updated');
    const called = await api('/reception/call-next', 'POST', { barberId: 'ravi' }, staff);
    assert.equal(called.body.ticket?.id, ids[0]);
    const payload = await callEvent;
    assert.deepEqual(payload, { type: 'queue:updated', timestamp: Date.now() });
    const dashboard = await api('/barber/ravi/dashboard', 'GET', undefined, ravi);
    assert.equal(dashboard.body.assignment.customerName, customerName);
    assert.equal(dashboard.body.assignment.durationMinutes, 30);
    assert.equal(dashboard.body.assignment.services[0].nameEn, 'Classic Haircut');
    assert.equal(dashboard.body.nextToken, 'S-3');
    assert.equal(dashboard.body.canToggleAvailability, false);
    assert.equal((await api('/barber/amit/dashboard', 'GET', undefined, amit)).body.assignment, null);
    assert.equal((await api(`/barber/amit/assignments/${ids[0]}/start`, 'POST', undefined, amit)).status, 404);
    assert.equal((await api(`/barber/ravi/assignments/${ids[0]}/start`, 'POST', undefined, amit)).status, 403);
    assert.equal((await api(`/barber/ravi/assignments/${ids[0]}/done`, 'POST', undefined, ravi)).status, 409);
    assert.equal((await api('/barber/ravi/availability', 'PATCH', { status: 'break' }, ravi)).status, 409);
    assert.deepEqual((await api('/display')).body.barbers.find((row: { name: string }) => row.name === 'Ravi'),
      { name: 'Ravi', token: 'S-1', status: 'called' });

    const started = event('queue:updated');
    const replies = await Promise.all([1, 2].map(() => api(`/barber/ravi/assignments/${ids[0]}/start`, 'POST', undefined, ravi)));
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [204, 409]);
    await started;
    assert.deepEqual(db.prepare('SELECT status, started_at FROM queue_entries WHERE id = ?').get(ids[0]),
      { status: 'in_chair', started_at: new Date().toISOString() });
    assert.equal((await api('/barber/ravi/availability', 'PATCH', { status: 'break' }, ravi)).status, 409);
    assert.equal((await api(`/barber/amit/assignments/${ids[0]}/done`, 'POST', undefined, amit)).status, 404);

    const disconnected = event('disconnect');
    const reconnected = event('connect');
    socket.io.engine.close();
    await disconnected;
    await reconnected;
    const done = event('queue:updated');
    assert.equal((await api(`/barber/ravi/assignments/${ids[0]}/done`, 'POST', undefined, ravi)).status, 204);
    await done;
    assert.equal((await api(`/barber/ravi/assignments/${ids[0]}/done`, 'POST', undefined, ravi)).status, 409);
    assert.deepEqual(db.prepare('SELECT status, completed_at FROM queue_entries WHERE id = ?').get(ids[0]),
      { status: 'done', completed_at: new Date().toISOString() });
    assert.deepEqual((await api('/display')).body.barbers.find((row: { name: string }) => row.name === 'Ravi'),
      { name: 'Ravi', token: null, status: 'available' });
  });

  await t.test('server rate limits failed sign-ins and expires existing sessions', async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      assert.equal((await login('ravi', randomBytes(16).toString('hex'))).status, 401);
    }
    assert.equal((await login('amit', credentials.amit)).status, 429);
    t.mock.timers.tick(4 * 60 * 60 * 1000);
    assert.equal((await api('/barber/ravi/dashboard', 'GET', undefined, ravi)).status, 401);
    assert.equal((await login('amit', credentials.amit)).status, 200);
  });
});
