import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { queueRouter } from './routes/queue.js';
import { salonRouter } from './routes/salon.js';
import { devTestRouter } from './routes/devTest.js';
import { receptionRouter } from './routes/reception.js';
import { initializeDatabaseSchema } from './db/schema.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Initialize SQLite schema and seed defaults on startup
initializeDatabaseSchema();

// Mount API routes
app.use('/api', healthRouter);
app.use('/api/queue', queueRouter);
app.use('/api/salon', salonRouter);
app.use('/api/reception', receptionRouter);

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
