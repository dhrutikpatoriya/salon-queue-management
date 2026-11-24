import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { QUEUE_REFRESH_MS, subscribeToQueue } from '../src/utils/liveQueue';

test('live queue refreshes on reconnect and on a 30-second fallback without replaying calls', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const socket = Object.assign(new EventEmitter(), {
    connected: true,
    active: true,
    connect() { return this; },
  });
  const highlights: boolean[] = [];
  const connected: boolean[] = [];
  const live = subscribeToQueue(socket, async (_signal, animate) => {
    highlights.push(animate);
  }, (online) => connected.push(online));
  t.after(() => live.stop());
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

  await flush();
  assert.deepEqual(highlights, [false]);
  socket.emit('queue:updated');
  await flush();
  assert.deepEqual(highlights, [false, true]);

  socket.connected = false;
  socket.emit('disconnect');
  await flush();
  t.mock.timers.tick(QUEUE_REFRESH_MS - 1);
  assert.equal(highlights.length, 3);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(highlights, [false, true, false, false]);

  socket.connected = true;
  socket.emit('connect');
  await flush();
  assert.deepEqual(connected, [true, false, true]);
  assert.deepEqual(highlights, [false, true, false, false, false]);
  socket.emit('queue:updated');
  await flush();
  assert.equal(highlights.at(-1), true);
  live.stop();
  t.mock.timers.tick(QUEUE_REFRESH_MS);
  assert.equal(highlights.length, 6);
});
