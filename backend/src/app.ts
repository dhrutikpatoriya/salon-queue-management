import { allowedOrigin, permitsOrigin, production } from './config/environment.js';
import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { adminRouter } from './routes/admin.js';
import { healthRouter } from './routes/health.js';
import { queueRouter } from './routes/queue.js';
import { salonRouter } from './routes/salon.js';
import { devTestRouter } from './routes/devTest.js';
import { barberRouter } from './routes/barber.js';
import { displayRouter } from './routes/display.js';
import { receptionRouter } from './routes/reception.js';
import { initializeDatabaseSchema } from './db/schema.js';

export const app = express();

app.disable('x-powered-by');
if (production) {
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${allowedOrigin?.replace(/^https:/, 'wss:')}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    });
    if (!permitsOrigin(req.get('Origin'))) {
      res.status(403).json({ error: 'originNotAllowed' });
      return;
    }
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
} else {
  app.use(cors());
}
const sensitivePath = /^\/api\/(?:admin|barber|reception)(?:\/|$)/i;
app.use((req, res, next) => {
  if (sensitivePath.test(req.path)) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json());

// Initialize SQLite schema and seed defaults on startup
initializeDatabaseSchema();

// Mount API routes
app.use('/api', healthRouter);
app.use('/api/queue', queueRouter);
app.use('/api/salon', salonRouter);
app.use('/api/reception', receptionRouter);
app.use('/api/barber', barberRouter);
app.use('/api/display', displayRouter);
app.use('/api/admin', adminRouter);

// Shortcuts for convenience
app.use('/api/services', (req, res) => {
  res.redirect(307, '/api/salon/services');
});
app.use('/api/barbers', (req, res) => {
  res.redirect(307, '/api/salon/barbers');
});

// Mount dev test router with internal strict isDevTestEnabled() guard
// Completely unavailable in production or when dev environment is missing
if (!production) app.use('/api/dev', devTestRouter);


// Malformed bodies can contain passwords. Keep body-parser errors out of responses and logs.
const protectAuthenticationErrors: ErrorRequestHandler = (error, req, res, next) => {
  if (!sensitivePath.test(req.path) || res.headersSent) {
    next(error);
    return;
  }
  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'requestFailed' : 'invalidRequest' });
};
app.use(protectAuthenticationErrors);

if (production) {
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'notFound' }); });
  app.use('/socket.io', (_req, res) => { res.status(404).json({ error: 'notFound' }); });
  const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  const index = join(frontend, 'index.html');
  accessSync(index, constants.R_OK);
  app.use('/assets', express.static(join(frontend, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use('/assets', (_req, res) => { res.sendStatus(404); });
  app.use(express.static(frontend, { index: false, dotfiles: 'ignore' }));
  app.get(['/', '/join', '/status/:id?', '/reception', '/barber/:name?', '/display', '/admin'], (req, res) => {
    if (!req.accepts('html')) { res.sendStatus(404); return; }
    res.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
