import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

if (process.env.NODE_ENV !== 'test' || !process.env.SALON_PERSISTENCE_TEST_DIR) {
  throw new Error('The persistence worker requires a disposable test database');
}

const { db } = await import('../db/database.js');
assert.equal(db.memory, false);
const { app } = await import('../app.js');
const server = createServer(app);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const port = (server.address() as AddressInfo).port;
  const request = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}/api${path}`, init);
  const password = process.env.OWNER_PASSWORD;
  assert.ok(password);
  const login = await request('/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const settings = { openTime: '07:15', closeTime: '20:45', onlineJoiningEnabled: false };

  if (process.argv[2] === 'write') {
    const save = await request('/admin/settings', { method: 'PATCH', headers, body: JSON.stringify(settings) });
    assert.equal(save.status, 204);
  } else {
    assert.equal(process.argv[2], 'read');
  }
  const read = await request('/admin/dashboard', { headers });
  assert.equal(read.status, 200);
  const { openTime, closeTime, onlineJoiningEnabled, cutoffTime } = (await read.json()).settings;
  assert.deepEqual({ openTime, closeTime, onlineJoiningEnabled, cutoffTime }, { ...settings, cutoffTime: '20:15' });
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
}
