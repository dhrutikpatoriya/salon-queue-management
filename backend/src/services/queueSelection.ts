import { db } from '../db/database.js';
import type { QueueEntryRow } from './queueService.js';

export function nextWaitingForBarber(date: string, barberId: string) {
  return db.prepare(`
    SELECT * FROM queue_entries
    WHERE created_date = ? AND status = 'waiting'
      AND barber_preference IN (?, 'any')
    ORDER BY token_number ASC LIMIT 1
  `).get(date, barberId) as QueueEntryRow | undefined;
}

export function activeAssignment(barberId: string) {
  return db.prepare(`
    SELECT * FROM queue_entries
    WHERE assigned_barber_id = ? AND status IN ('called', 'in_chair')
    ORDER BY created_date ASC, token_number ASC LIMIT 1
  `).get(barberId) as QueueEntryRow | undefined;
}
