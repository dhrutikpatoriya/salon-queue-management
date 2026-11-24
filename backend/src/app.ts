import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

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

app.use(cors());
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
app.use('/api/dev', devTestRouter);


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
