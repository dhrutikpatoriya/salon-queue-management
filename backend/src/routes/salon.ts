import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { englishClock, getLocalTodayDate, getOnlineClosureReason, getSalonOperatingStatus, SALON_TIMEZONE } from '../utils/timeUtils.js';

import { calculateQueuePositionAndTime } from '../services/queueService.js';

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
      `SELECT id, name, status FROM barbers WHERE is_on_duty = 1 AND status != 'off_duty'`
    ).all();
    return res.status(200).json({ success: true, barbers });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/salon/status - Check if salon and online queue are open
salonRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const hours = getSalonOperatingStatus(now);
    const date = getLocalTodayDate(now);
    const preview = (barberPreference: string) => calculateQueuePositionAndTime({
      created_date: date, created_at: '\uffff', status: 'waiting', barber_preference: barberPreference,
    }).approxWaitMinutes;
    const { waitingCount } = db.prepare(
      "SELECT count(*) AS waitingCount FROM queue_entries WHERE created_date = ? AND status = 'waiting'"
    ).get(date) as { waitingCount: number };
    const barberIds = db.prepare("SELECT id FROM barbers WHERE is_on_duty = 1 AND status != 'off_duty'").all() as Array<{ id: string }>;
    return res.set('Cache-Control', 'no-store').json({
      success: true,
      timezone: SALON_TIMEZONE,
      ...hours,
      operatingHours: `${englishClock(hours.openTime)} – ${englishClock(hours.closeTime)}`,
      onlineJoiningClosesAt: englishClock(hours.cutoffTime),
      reason: getOnlineClosureReason(hours) ?? null,
      waitingCount,
      approxWaitMinutes: preview('any'),
      barberWaitMinutes: Object.fromEntries(barberIds.map(({ id }) => [id, preview(id)])),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
