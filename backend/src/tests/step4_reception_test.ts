import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

// Set test mode before importing anything that opens SQLite or loads .env.
process.env.NODE_ENV = 'test';
const staffPin = '4826';
process.env.STAFF_PIN = staffPin;

test('Step 4 Reception Dashboard', async (t) => {
  // 8:45 PM in Asia/Kolkata: walk-ins are open and online joining is closed.
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T15:15:00Z') });

  const { db } = await import('../db/database.js');
  assert.equal(db.memory, true, 'Reception tests require an in-memory database');
  t.after(() => db.close());

  const { app } = await import('../app.js');
  const { setupSocketIO } = await import('../socket/socketHandler.js');
  const { resetStaffAuthStoreForTesting } = await import('../middleware/staffAuth.js');
  const server = createServer(app);
  const io = setupSocketIO(server);
  t.after(() => io.close());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;
  async function request(path: string, body?: object, token?: string) {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  }

  await t.test('dashboard requires staff authentication', async () => {
    assert.equal((await request('/reception/dashboard')).status, 401);
  });

  await t.test('five invalid PINs trigger the rate limit on the next attempt', async () => {
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        assert.equal((await request('/reception/login', { pin: 'wrong' })).status, 401);
      }
      assert.equal((await request('/reception/login', { pin: 'wrong' })).status, 429);
    } finally {
      resetStaffAuthStoreForTesting();
    }
  });

  const login = await request('/reception/login', { pin: staffPin });
  const token = login.body.token;
  await t.test('valid PIN grants dashboard access without exposing the PIN', async () => {
    assert.equal(login.status, 200);
    assert.match(token, /^\S+$/);
    assert.equal(Object.hasOwn(login.body, 'pin'), false);
    assert.equal(Object.values(login.body).includes(staffPin), false);
    assert.equal((await request('/reception/dashboard', undefined, token)).status, 200);
  });
  assert.ok(token, 'Remaining checks require a staff session');

  function staffPost(path: string, body: object = {}) {
    return request(`/reception${path}`, body, token);
  }

  function customer(phoneNumber: string, barberPreference = 'any') {
    return { customerName: 'Test Customer', phoneNumber, serviceIds: ['haircut'], barberPreference };
  }

  async function walkIn(phoneNumber: string, barberPreference = 'any') {
    const response = await staffPost('/walk-in', customer(phoneNumber, barberPreference));
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.ticket as { id: string; tokenNumber: number };
  }

  function queueState(id: string) {
    return db.prepare('SELECT status, assigned_barber_id, is_walk_in FROM queue_entries WHERE id = ?').get(id);
  }

  await t.test('walk-ins get sequential tokens after online joining closes', async () => {
    const online = await request('/queue/join', customer('9000000001'));
    assert.equal(online.status, 403);
    assert.match(online.body.error, /closes at 8:30 PM/i);

    const first = await walkIn('9000000001');
    const second = await walkIn('9000000002');
    assert.equal(first.tokenNumber, 1);
    assert.equal(second.tokenNumber, 2);
    assert.deepEqual(queueState(first.id), { status: 'waiting', assigned_barber_id: null, is_walk_in: 1 });
    assert.deepEqual(queueState(second.id), queueState(first.id));

    for (const ticket of [first, second]) {
      assert.equal((await staffPost(`/cancel/${ticket.id}`)).status, 200);
      assert.deepEqual(queueState(ticket.id), { status: 'cancelled', assigned_barber_id: null, is_walk_in: 1 });
    }
  });

  await t.test('Amit skips Ravi-only and calls the earliest eligible ticket', async () => {
    const raviOnly = await walkIn('9000000003', 'ravi');
    const any = await walkIn('9000000004');
    const amitOnly = await walkIn('9000000005', 'amit');

    const call = await staffPost('/call-next', { barberId: 'amit' });
    assert.equal(call.status, 200);
    assert.equal(call.body.called, true);
    assert.equal(call.body.ticket?.id, any.id);
    assert.equal(call.body.ticket.assignedBarber, 'Amit');
    assert.deepEqual(queueState(any.id), { status: 'called', assigned_barber_id: 'amit', is_walk_in: 1 });
    assert.deepEqual(queueState(raviOnly.id), { status: 'waiting', assigned_barber_id: null, is_walk_in: 1 });
    assert.deepEqual(queueState(amitOnly.id), queueState(raviOnly.id));

    const busy = await staffPost('/call-next', { barberId: 'amit' });
    assert.equal(busy.status, 400);
    assert.match(busy.body.error, /already reserved/i);
    assert.deepEqual(queueState(amitOnly.id), queueState(raviOnly.id));
  });

  await t.test('no-show respects the ten-minute grace period and frees the barber', async () => {
    const call = await staffPost('/call-next', { barberId: 'ravi' });
    assert.equal(call.status, 200);
    assert.equal(call.body.called, true);
    const id = call.body.ticket.id;

    const early = await staffPost(`/no-show/${id}`);
    assert.equal(early.status, 400);
    assert.match(early.body.error, /grace period.*remaining/i);
    assert.deepEqual(queueState(id), { status: 'called', assigned_barber_id: 'ravi', is_walk_in: 1 });

    t.mock.timers.tick(10 * 60 * 1000);
    const expired = await staffPost(`/no-show/${id}`);
    assert.equal(expired.status, 200);
    assert.deepEqual(queueState(id), { status: 'no_show', assigned_barber_id: 'ravi', is_walk_in: 1 });
    assert.deepEqual(db.prepare("SELECT status FROM barbers WHERE id = 'ravi'").get(), { status: 'available' });

    const rejoined = await walkIn('9000000003', 'ravi');
    assert.notEqual(rejoined.id, id);
    assert.equal(rejoined.tokenNumber, 6);
  });

  await t.test('an available barber with no eligible customer returns no call', async () => {
    const response = await staffPost('/call-next', { barberId: 'imran' });
    assert.equal(response.status, 200);
    assert.equal(response.body.called, false);
    assert.equal(response.body.ticket, null);
  });

  const eligibleTicket = await walkIn('9000000006');
  for (const state of ['break', 'off_duty', 'busy'] as const) {
    await t.test(`dashboard and Call Next agree when a barber is ${state} without an active ticket`, async () => {
      db.prepare("UPDATE barbers SET status = ? WHERE id = 'imran'").run(state);
      const dashboard = await request('/reception/dashboard', undefined, token);
      assert.equal(dashboard.status, 200);
      const barber = dashboard.body.data.barbers.find((row: { id: string }) => row.id === 'imran');
      const call = await staffPost('/call-next', { barberId: 'imran' });
      assert.deepEqual({
        operationalState: barber.operationalState,
        dutyStatus: barber.dutyStatus,
        currentTicket: barber.currentTicket,
        callStatus: call.status,
        ticketState: queueState(eligibleTicket.id),
      }, {
        operationalState: state,
        dutyStatus: state === 'off_duty' ? 'off_duty' : 'on_duty',
        currentTicket: null,
        callStatus: 400,
        ticketState: { status: 'waiting', assigned_barber_id: null, is_walk_in: 1 },
      });
    });
  }

  await t.test('concurrent calls for Amit claim exactly one eligible ticket', async () => {
    const assigned = db.prepare("SELECT id FROM queue_entries WHERE assigned_barber_id = 'amit' AND status = 'called'").pluck().get() as string;
    assert.equal((await staffPost(`/no-show/${assigned}`)).status, 200);
    const before = (await request('/reception/dashboard', undefined, token)).body.data.barbers
      .find((barber: { id: string }) => barber.id === 'amit');
    assert.equal(before.canCallNext, true);
    const expected = db.prepare("SELECT id FROM queue_entries WHERE status = 'waiting' AND barber_preference IN ('amit','any') ORDER BY token_number LIMIT 1").pluck().get();
    const outcomes = await Promise.all([
      staffPost('/call-next', { barberId: 'amit' }),
      staffPost('/call-next', { barberId: 'amit' }),
    ]);
    assert.deepEqual(outcomes.map(({ status }) => status).sort(), [200, 400]);
    assert.equal(outcomes.find(({ status }) => status === 200)?.body.ticket.id, expected);
    const after = (await request('/reception/dashboard', undefined, token)).body.data.barbers
      .find((barber: { id: string }) => barber.id === 'amit');
    assert.equal(after.canCallNext, false);
  });

  await t.test('expired staff session cannot call a ticket', async () => {
    t.mock.timers.tick(4 * 60 * 60 * 1000);
    const response = await staffPost('/call-next', { barberId: 'ravi' });
    assert.equal(response.status, 401);
    assert.match(response.body.error, /session expired/i);
  });
});
