import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const dbHealth = checkDbHealth();

  if (!dbHealth.ok) {
    return res.status(500).json({
      status: 'error',
      system: 'Salon Queue Management System',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'disconnected',
        error: dbHealth.message
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
