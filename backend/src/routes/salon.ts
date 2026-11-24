import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { isOnlineJoiningAllowed, SALON_TIMEZONE } from '../utils/timeUtils.js';

export const salonRouter = Router();

// GET /api/salon/services - List all active services
salonRouter.get('/services', (_req: Request, res: Response) => {
  try {
    const services = db.prepare(
      `SELECT id, name_en, name_gu, category, duration_minutes, price FROM services WHERE is_active = 1`
    ).all();
    return res.status(200).json({ success: true, services });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/salon/barbers - List on-duty barbers
salonRouter.get('/barbers', (_req: Request, res: Response) => {
  try {
    const barbers = db.prepare(
      `SELECT id, name, status FROM barbers WHERE is_on_duty = 1`
    ).all();
    return res.status(200).json({ success: true, barbers });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/salon/status - Check if salon and online queue are open
salonRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const hours = isOnlineJoiningAllowed();
    return res.status(200).json({
      success: true,
      timezone: SALON_TIMEZONE,
      operatingHours: '9:00 AM – 9:00 PM',
      onlineJoiningClosesAt: '8:30 PM',
      isOnlineJoiningOpen: hours.allowed,
      reason: hours.reason || null
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
