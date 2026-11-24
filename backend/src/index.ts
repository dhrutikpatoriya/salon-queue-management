import { production } from './config/environment.js';
import http from 'node:http';

const port = Number(process.env.PORT || 5001);
if (!Number.isInteger(port) || port < 0 || port > 65535 || (port === 0 && !production)) {
  throw new Error('Invalid PORT');
}

const { app } = await import('./app.js');
const { db } = await import('./db/database.js');
const { setupSocketIO } = await import('./socket/socketHandler.js');

if (production) {
  const { bootstrapCredentials, credentialAccounts, isCredentialConfigured } = await import('./services/credentialService.js');
  if (process.env.BOOTSTRAP_CREDENTIALS === 'true') {
    await bootstrapCredentials(true);
  }
  if (!credentialAccounts().every(({ id }) => isCredentialConfigured(id))) {
    db.close();
    throw new Error('Initialize all production credential hashes before serving traffic');
  }
}

const server = http.createServer(app);
const io = setupSocketIO(server);
server.listen(port, '0.0.0.0', () => {
  const address = server.address();
  if (address && typeof address !== 'string') {
    console.log(`[Backend Server] Listening on port ${address.port}`);
  }
});
if (production) {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void io.close(() => db.close());
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
