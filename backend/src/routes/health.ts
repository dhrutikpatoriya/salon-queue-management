import { production } from '../config/environment.js';
import { Router, Request, Response } from 'express';
import { checkDbHealth, db } from '../db/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const dbHealth = checkDbHealth();
  if (process.env.NODE_ENV === 'test' && db.memory && process.env.SALON_E2E_RUN_ID) {
    res.set('X-Salon-Isolated-Run', process.env.SALON_E2E_RUN_ID);
  }

  if (!dbHealth.ok) {
    return res.status(500).json({
      status: 'error',
      system: 'Salon Queue Management System',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'disconnected',
        error: production ? 'Database unavailable' : dbHealth.message
      }
    });
  }

  return res.status(200).json({
    status: 'ok',
    system: 'Salon Queue Management System',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: 'connected',
      message: dbHealth.message
    }
  });
});
