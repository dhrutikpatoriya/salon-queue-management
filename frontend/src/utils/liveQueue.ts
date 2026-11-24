type QueueEvent = 'connect' | 'disconnect' | 'connect_error' | 'queue:updated';

interface QueueSocket {
  connected: boolean;
  active: boolean;
  connect(): unknown;
  on(event: QueueEvent, handler: () => void): unknown;
  off(event: QueueEvent, handler: () => void): unknown;
}

export const QUEUE_REFRESH_MS = 30_000;

export function subscribeToQueue(
  socket: QueueSocket,
  refresh: (signal: AbortSignal, allowHighlight: boolean) => Promise<void | number>,
  connectionChanged: (connected: boolean) => void,
) {
  let baselineNeeded = true;
  let pending = false;
  let request: AbortController | undefined;
  let stopped = false;
  let boundary: ReturnType<typeof setTimeout> | undefined;

  function update() {
    if (stopped) return;
    if (request) {
      pending = true;
      return;
    }
    const controller = new AbortController();
    request = controller;
    const allowHighlight = socket.connected && !baselineNeeded;
    void refresh(controller.signal, allowHighlight).then((refreshAfterMs) => {
      if (controller.signal.aborted) return;
      if (socket.connected) baselineNeeded = false;
      clearTimeout(boundary);
      if (typeof refreshAfterMs === 'number' && refreshAfterMs > 0 && refreshAfterMs < QUEUE_REFRESH_MS) {
        boundary = setTimeout(update, refreshAfterMs + 50);
      }
    }).catch(() => {
      // The view reports fetch errors and the next refresh retries.
    }).finally(() => {
      if (request === controller) request = undefined;
      if (!pending) return;
      pending = false;
      update();
    });
  }

  function connection() {
    baselineNeeded = true;
    request?.abort();
    connectionChanged(socket.connected);
    update();
  }

  socket.on('connect', connection);
  socket.on('disconnect', connection);
  socket.on('connect_error', connection);
  socket.on('queue:updated', update);
  connectionChanged(socket.connected);
  update();
  const interval = setInterval(() => {
    if (!socket.connected && !socket.active) socket.connect();
    update();
  }, QUEUE_REFRESH_MS);

  return {
    refresh: update,
    stop() {
      stopped = true;
      request?.abort();
      clearInterval(interval);
      clearTimeout(boundary);
      socket.off('connect', connection);
      socket.off('disconnect', connection);
      socket.off('connect_error', connection);
      socket.off('queue:updated', update);
    }
  };
}
