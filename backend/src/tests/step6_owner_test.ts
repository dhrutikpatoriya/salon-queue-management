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
const password = randomBytes(24).toString('hex');
const staffPin = randomBytes(16).toString('hex');
const barberCredential = randomBytes(16).toString('hex');
process.env.OWNER_PASSWORD = password;
process.env.STAFF_PIN = staffPin;
process.env.BARBER_CREDENTIALS = JSON.stringify({ ravi: barberCredential });

test('Step 6 Owner Settings', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T06:00:00Z') });
  const { db } = await import('../db/database.js');
  assert.equal(db.memory, true);
  const { app } = await import('../app.js');
  const { initializeDatabaseSchema } = await import('../db/schema.js');
  const server = createServer(app);
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.close();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;

  async function api(path: string, method = 'GET', body?: object, token?: string) {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method, headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  const ownerLogin = (secret = password) => api('/admin/login', 'POST', { password: secret });
  const owner = (await ownerLogin()).body.token;
  const staff = (await api('/reception/login', 'POST', { pin: staffPin })).body.token;
  const barber = (await api('/barber/ravi/login', 'POST', { credential: barberCredential })).body.token;
  const ownerApi = (path: string, method = 'GET', body?: object) => api('/admin' + path, method, body, owner);
  const setClock = (time: string) => t.mock.timers.setTime(Date.parse(`2026-11-24T${time}+05:30`));
  const hours = { openTime: '11:00', closeTime: '13:00', onlineJoiningEnabled: true };
  const customer = (phone: string, selection = 'ravi') => ({
    customerName: 'Private owner test fixture', phoneNumber: phone, serviceIds: ['haircut'], barberPreference: selection,
  });

  await t.test('owner configuration, role separation, and logout', async () => {
    assert.equal(typeof owner, 'string');
    for (const token of [undefined, staff, barber]) {
      assert.equal((await api('/admin/dashboard', 'GET', undefined, token)).status, 401);
      assert.equal((await api('/admin/settings', 'PATCH', hours, token)).status, 401);
    }
    assert.equal((await api('/reception/dashboard', 'GET', undefined, owner)).status, 401);
    delete process.env.OWNER_PASSWORD;
    try {
      assert.equal((await ownerLogin()).status, 503);
    } finally {
      process.env.OWNER_PASSWORD = password;
    }
    process.env.OWNER_PASSWORD = staffPin;
    try {
      assert.equal((await ownerLogin(staffPin)).status, 503);
    } finally {
      process.env.OWNER_PASSWORD = password;
    }
    const token = (await ownerLogin()).body.token;
    assert.equal((await api('/admin/logout', 'POST', undefined, token)).status, 204);
    assert.equal((await api('/admin/dashboard', 'GET', undefined, token)).status, 401);
  });

  await t.test('non-destructive settings upgrade preserves legacy hours and records', async () => {
    db.prepare("UPDATE salon_settings SET value = '0' WHERE key = 'is_open'").run();
    db.prepare("UPDATE salon_settings SET value = '10:00' WHERE key = 'open_time'").run();
    db.prepare("DELETE FROM salon_settings WHERE key = 'online_joining_enabled'").run();
    initializeDatabaseSchema();
    const { settings } = (await ownerApi('/dashboard')).body;
    assert.equal(settings.openTime, '10:00');
    assert.equal(settings.onlineJoiningEnabled, true);
    assert.deepEqual(db.prepare("SELECT value FROM salon_settings WHERE key = 'is_open'").get(), { value: '0' });
  });

  await t.test('Asia/Kolkata opening, cutoff, closing, and online switch govern both join paths', async () => {
    for (const bad of [{ ...hours, closeTime: '11:15' }, { ...hours, openTime: '24:00' }, { ...hours, onlineJoiningEnabled: 'false' }]) {
      assert.equal((await ownerApi('/settings', 'PATCH', bad)).status, 400);
    }
    assert.equal((await ownerApi('/settings', 'PATCH', hours)).status, 204);
    const scenarios = [
      ['10:59:59.999', false, false, 'beforeOpening'],
      ['11:00:00.000', true, true, null],
      ['12:29:59.999', true, true, null],
      ['12:30:00.000', true, false, 'onlineCutoff'],
      ['12:59:59.999', true, false, 'onlineCutoff'],
      ['13:00:00.000', false, false, 'afterClosing'],
    ] as const;

    for (const [index, [clock, physical, online, reason]] of scenarios.entries()) {
      setClock(clock);
      const { body } = await api('/salon/status');
      assert.deepEqual([body.timezone, body.salonOpen, body.isOnlineJoiningOpen, body.reasonCode, body.cutoffTime],
        ['Asia/Kolkata', physical, online, reason, '12:30']);
      assert.equal((await api('/display')).body.salonOpen, physical);
      assert.equal((await api('/reception/dashboard', 'GET', undefined, staff)).body.data.salonOpen, physical);
      assert.equal((await api('/queue/join', 'POST', customer(`900000001${index}`))).status, online ? 201 : 403);
      assert.equal((await api('/reception/walk-in', 'POST', customer(`900000002${index}`), staff)).status, physical ? 201 : 403);
    }
    setClock('11:30:00.000');
    assert.equal((await ownerApi('/settings', 'PATCH', { ...hours, onlineJoiningEnabled: false })).status, 204);
    assert.equal((await api('/queue/join', 'POST', customer('9000000030'))).body.reasonCode, 'onlineDisabled');
    assert.equal((await api('/reception/walk-in', 'POST', customer('9000000030'), staff)).status, 201);
    initializeDatabaseSchema();
    assert.equal((await ownerApi('/dashboard')).body.settings.onlineJoiningEnabled, false);
    assert.equal((await ownerApi('/settings', 'PATCH', hours)).status, 204);
  });

  await t.test('catalog validates edits, preserves booked amounts, and returns private details only to the ticket owner', async () => {
    const accepted = (await api('/queue/join', 'POST', customer('9000000040'))).body.ticket;
    const service = { name_en: 'Test treatment', name_gu: 'પરીક્ષણ સેવા', category: 'spa', price: 120, duration_minutes: 25, is_active: 1 };
    assert.equal((await ownerApi('/services', 'POST', { ...service, price: -1 })).status, 400);
    assert.equal((await ownerApi('/services', 'POST', { ...service, duration_minutes: 2.5 })).status, 400);
    assert.equal((await ownerApi('/services', 'POST', { ...service, name_gu: ' ' })).status, 400);
    assert.equal((await ownerApi('/services', 'POST', service)).status, 201);
    assert.equal((await ownerApi('/services/haircut', 'PATCH', { price: 240, duration_minutes: 50 })).status, 204);
    const newTicket = (await api('/queue/join', 'POST', customer('9000000041'))).body.ticket;
    assert.deepEqual([newTicket.totalPrice, newTicket.totalDurationMinutes], [240, 50]);
    assert.equal((await ownerApi('/services/haircut', 'PATCH', { is_active: 0 })).status, 204);
    assert.equal((await api('/salon/services')).body.services.some((row: { id: string }) => row.id === 'haircut'), false);
    assert.equal((await api('/queue/join', 'POST', customer('9000000042'))).status, 400);
    assert.equal((await api('/reception/walk-in', 'POST', customer('9000000042'), staff)).status, 400);

    const ticketUrl = `/queue/${accepted.id}`;
    const publicTicket = (await api(ticketUrl)).body.ticket;
    assert.deepEqual([publicTicket.totalPrice, publicTicket.totalDurationMinutes, publicTicket.services[0].price, publicTicket.services[0].duration_minutes], [150, 30, 150, 30]);
    assert.equal('customerName' in publicTicket || 'phoneNumber' in publicTicket || 'accessToken' in publicTicket, false);
    assert.equal((await api(`${ticketUrl}?token=${accepted.accessToken}`)).body.ticket.customerName, 'Private owner test fixture');
    assert.equal((await api(`${ticketUrl}/cancel`, 'POST', {})).status, 401);
    const dashboard = await ownerApi('/dashboard');
    for (const data of [dashboard.body, (await api('/display')).body, (await api('/salon/status')).body]) {
      assert.equal(JSON.stringify(data).includes('Private owner test fixture') || JSON.stringify(data).includes('9000000040'), false);
    }
  });

  await t.test('duty changes preserve preferences and reject off-duty during a call or service', async () => {
    assert.equal((await ownerApi('/services/haircut', 'PATCH', { is_active: 1 })).status, 204);
    const preferred = (await api('/queue/join', 'POST', customer('9000000050'))).body.ticket;
    const duty = (onDuty: boolean) => ownerApi('/barbers/ravi/duty', 'PATCH', { onDuty });
    assert.equal((await duty(false)).status, 204);
    assert.equal((await api('/salon/barbers')).body.barbers.some((row: { id: string }) => row.id === 'ravi'), false);
    assert.equal((await api('/queue/join', 'POST', customer('9000000051'))).status, 400);
    const waiting = (await api(`/queue/${preferred.id}`)).body.ticket;
    assert.deepEqual([waiting.barberPreference, waiting.status, waiting.waitReasonCode], ['ravi', 'waiting', 'preferredOffDuty']);
    assert.equal((await api('/reception/call-next', 'POST', { barberId: 'amit' }, staff)).body.called, false);
    assert.equal((await duty(true)).status, 204);
    const called = (await api('/reception/call-next', 'POST', { barberId: 'ravi' }, staff)).body.ticket;
    assert.equal(called.tokenDisplay, 'S-1');
    assert.equal((await ownerApi('/dashboard')).body.stats.called, 1);
    assert.equal((await duty(false)).status, 409);
    assert.equal((await api(`/barber/ravi/assignments/${called.id}/start`, 'POST', undefined, barber)).status, 204);
    assert.equal((await ownerApi('/dashboard')).body.stats.in_chair, 1);
    assert.equal((await duty(false)).status, 409);
    assert.equal((await api(`/barber/ravi/assignments/${called.id}/done`, 'POST', undefined, barber)).status, 204);
    const stats = (await ownerApi('/dashboard')).body.stats;
    assert.deepEqual(stats, { waiting: 9, called: 0, in_chair: 0, done: 1, cancelled: 0, no_show: 0, averageWaitMinutes: 30 });
    assert.equal((await api(`/reception/cancel/${preferred.id}`, 'POST', {}, staff)).status, 200);
    const missed = (await api('/reception/call-next', 'POST', { barberId: 'ravi' }, staff)).body.ticket;
    assert.ok(missed?.id);
    setClock('11:41:00.000');
    assert.equal((await api(`/reception/no-show/${missed.id}`, 'POST', {}, staff)).status, 200);
    const finalStats = (await ownerApi('/dashboard')).body.stats;
    assert.deepEqual([finalStats.waiting, finalStats.cancelled, finalStats.no_show], [7, 1, 1]);
    assert.equal((await duty(false)).status, 204);
  });

  await t.test('rate limiting and server-side owner session expiry', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await ownerLogin('invalid')).status, 401);
    assert.equal((await ownerLogin()).status, 429);
    setClock('16:00:00.000');
    assert.equal((await ownerApi('/dashboard')).status, 401);
    assert.equal((await ownerLogin()).status, 200);
  });
});

test('saved settings survive two backend processes using a disposable SQLite database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'salon-persistence-'));
  try {
    const worker = fileURLToPath(new URL('./step6_persistence_worker.js', import.meta.url));
    for (const phase of ['write', 'read']) {
      const result = spawnSync(process.execPath, [worker, phase], {
        env: { ...process.env, NODE_ENV: 'test', SALON_PERSISTENCE_TEST_DIR: directory, OWNER_PASSWORD: password },
        encoding: 'utf8', timeout: 15000,
      });
      assert.equal(result.status, 0, `Disposable backend ${phase} process failed: ${result.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
