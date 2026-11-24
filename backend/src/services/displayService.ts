import { db } from '../db/database.js';
import { getLocalTodayDate, isSalonOpen } from '../utils/timeUtils.js';
import { activeAssignment } from './queueSelection.js';
import { calculateQueuePositionAndTime } from './queueService.js';
import type { BarberRecord, QueueEntryRow } from './queueService.js';

const readDisplay = db.transaction(() => {
  const today = getLocalTodayDate();
  const barbers = db.prepare(`
    SELECT id, name, status FROM barbers
    WHERE is_on_duty = 1 AND status != 'off_duty'
    ORDER BY name, id
  `).all() as Pick<BarberRecord, 'id' | 'name' | 'status'>[];

  const waiting = db.prepare(`
    SELECT created_date, created_at, barber_preference, token_display, status
    FROM queue_entries WHERE created_date = ? AND status = 'waiting'
    ORDER BY token_number ASC LIMIT 5
  `).all(today) as Pick<QueueEntryRow, 'created_date' | 'created_at' | 'barber_preference' | 'token_display' | 'status'>[];

  return {
    date: today,
    salonOpen: isSalonOpen().open,
    barbers: barbers.map((barber) => {
      const active = activeAssignment(barber.id);
      return {
        name: barber.name,
        status: active?.status ?? barber.status,
        token: active?.token_display ?? null,
      };
    }),
    waiting: waiting.map((ticket) => ({
      token: ticket.token_display,
      approxWaitMinutes: calculateQueuePositionAndTime(ticket).approxWaitMinutes,
    })),
  };
});

export function getDisplayData() {
  return readDisplay();
}
