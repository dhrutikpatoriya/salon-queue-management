import { db } from '../db/database.js';
import { getLocalTodayDate } from '../utils/timeUtils.js';
import { activeAssignment, nextWaitingForBarber } from './queueSelection.js';
import type { BarberRecord, QueueEntryRow } from './queueService.js';

export class BarberActionError extends Error {
  constructor(public status: number, code: string) {
    super(code);
  }
}

function readBarber(id: string) {
  return db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as BarberRecord;
}

export function getBarberDashboard(id: string) {
  const barber = readBarber(id);
  const active = activeAssignment(id);
  const onDuty = barber.is_on_duty === 1 && barber.status !== 'off_duty';
  const next = onDuty ? nextWaitingForBarber(getLocalTodayDate(), id) : undefined;
  return {
    name: barber.name,
    status: onDuty ? barber.status : 'off_duty',
    canToggleAvailability: onDuty && !active,
    nextToken: next?.token_display ?? null,
    assignment: active ? {
      id: active.id,
      token: active.token_display,
      customerName: active.customer_name,
      status: active.status,
      durationMinutes: active.total_duration_minutes,
      startedAt: active.started_at,
      services: db.prepare(`
        SELECT s.name_en AS nameEn, s.name_gu AS nameGu, qs.duration_minutes AS durationMinutes
        FROM queue_services qs JOIN services s ON s.id = qs.service_id
        WHERE qs.queue_id = ? ORDER BY s.id
      `).all(active.id),
    } : null,
  };
}

const transition = db.transaction((barberId: string, ticketId: string, action: 'start' | 'done') => {
  const ticket = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND assigned_barber_id = ?')
    .get(ticketId, barberId) as QueueEntryRow | undefined;
  if (!ticket) throw new BarberActionError(404, 'assignmentNotFound');

  const now = new Date().toISOString();
  if (action === 'start') {
    const started = db.prepare(`
      UPDATE queue_entries SET status = 'in_chair', started_at = ?
      WHERE id = ? AND status = 'called' AND created_date = ?
        AND NOT EXISTS (
          SELECT 1 FROM queue_entries WHERE assigned_barber_id = ? AND status = 'in_chair'
        )
    `).run(now, ticket.id, getLocalTodayDate(), barberId);
    if (!started.changes) throw new BarberActionError(409, 'invalidTransition');
    db.prepare("UPDATE barbers SET status = 'busy' WHERE id = ? AND status = 'available'").run(barberId);
    return;
  }

  const finished = db.prepare(`
    UPDATE queue_entries SET status = 'done', completed_at = ? WHERE id = ? AND status = 'in_chair'
  `).run(now, ticket.id);
  if (!finished.changes) throw new BarberActionError(409, 'invalidTransition');
  if (!activeAssignment(barberId)) {
    db.prepare("UPDATE barbers SET status = 'available' WHERE id = ? AND status = 'busy'").run(barberId);
  }
});

export function changeAssignment(barberId: string, ticketId: string, action: 'start' | 'done') {
  transition.immediate(barberId, ticketId, action);
}

const availability = db.transaction((id: string, status: unknown) => {
  if (status !== 'available' && status !== 'break') throw new BarberActionError(400, 'invalidAvailability');
  const barber = readBarber(id);
  if (barber.is_on_duty !== 1 || barber.status === 'off_duty') throw new BarberActionError(409, 'offDuty');
  if (activeAssignment(id)) throw new BarberActionError(409, 'activeAssignment');
  db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(status, id);
});

export function changeAvailability(id: string, status: unknown) {
  availability.immediate(id, status);
}
