import { isCredentialConfigured } from './credentialService.js';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database.js';
import { activeAssignment } from './queueSelection.js';
import { saveSalonSettings, validOperatingHours } from './salonSettingsService.js';
import { getLocalTodayDate, getSalonOperatingStatus } from '../utils/timeUtils.js';
import type { BarberRecord } from './queueService.js';

export class AdminError extends Error {
  constructor(public status: number, code: string) { super(code); }
}

export function getOwnerDashboard() {
  const date = getLocalTodayDate();
  const counts = { waiting: 0, called: 0, in_chair: 0, done: 0, cancelled: 0, no_show: 0 };
  const rows = db.prepare('SELECT status, count(*) AS count FROM queue_entries WHERE created_date = ? GROUP BY status')
    .all(date) as Array<{ status: keyof typeof counts; count: number }>;
  for (const { status, count } of rows) counts[status] = count;
  const { average } = db.prepare(`
    SELECT AVG((julianday(called_at) - julianday(created_at)) * 1440) AS average
    FROM queue_entries WHERE created_date = ?
      AND julianday(called_at) >= julianday(created_at)
  `).get(date) as { average: number | null };
  return {
    date,
    settings: getSalonOperatingStatus(),
    services: db.prepare('SELECT * FROM services ORDER BY name_en, id').all(),
    receptionistCredentialConfigured: isCredentialConfigured('reception'),
    barbers: (db.prepare('SELECT id, name, status, is_on_duty FROM barbers ORDER BY name, id').all() as BarberRecord[])
      .map((barber) => ({
        ...barber,
        hasActiveAssignment: Boolean(activeAssignment(barber.id)),
        credentialConfigured: isCredentialConfigured(`barber:${barber.id}`),
      })),
    stats: { ...counts, averageWaitMinutes: average === null ? null : Math.round(average) },
  };
}

function serviceInput(input: Record<string, unknown>) {
  const nameEn = typeof input.name_en === 'string' ? input.name_en.trim() : '';
  const nameGu = typeof input.name_gu === 'string' ? input.name_gu.trim() : '';
  const { category, duration_minutes: duration, price, is_active: active } = input;
  if (!nameEn || !nameGu || nameEn.length > 100 || nameGu.length > 100 ||
      typeof category !== 'string' || !['hair', 'beard', 'spa', 'color'].includes(category) ||
      typeof duration !== 'number' || !Number.isSafeInteger(duration) || duration < 1 || duration > 1440 ||
      typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0 || price > Math.floor(Number.MAX_SAFE_INTEGER / 3) ||
      (active !== 0 && active !== 1)) {
    throw new AdminError(400, 'invalidService');
  }
  return [nameEn, nameGu, category, duration, price, active] as const;
}

export const saveService = db.transaction((input: Record<string, unknown>, id?: string) => {
  if (id) {
    const current = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!current) throw new AdminError(404, 'serviceMissing');
    db.prepare(`
      UPDATE services SET name_en=?, name_gu=?, category=?, duration_minutes=?, price=?, is_active=? WHERE id=?
    `).run(...serviceInput({ ...current, ...input }), id);
    return id;
  }
  const newId = randomUUID();
  db.prepare('INSERT INTO services(id,name_en,name_gu,category,duration_minutes,price,is_active) VALUES (?,?,?,?,?,?,?)')
    .run(newId, ...serviceInput(input));
  return newId;
});

export const setBarberDuty = db.transaction((id: string, onDuty: unknown) => {
  if (typeof onDuty !== 'boolean') throw new AdminError(400, 'invalidDuty');
  const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as BarberRecord | undefined;
  if (!barber) throw new AdminError(404, 'barberMissing');
  if (!onDuty && activeAssignment(id)) throw new AdminError(409, 'activeAssignment');
  if (onDuty === (barber.is_on_duty === 1 && barber.status !== 'off_duty')) return;
  db.prepare('UPDATE barbers SET is_on_duty = ?, status = ? WHERE id = ?')
    .run(onDuty ? 1 : 0, onDuty ? 'available' : 'off_duty', id);
});

export function updateSalonSettings(input: Record<string, unknown>) {
  const { openTime, closeTime, onlineJoiningEnabled } = input;
  if (typeof openTime !== 'string' || typeof closeTime !== 'string' ||
      !validOperatingHours(openTime, closeTime) || typeof onlineJoiningEnabled !== 'boolean') {
    throw new AdminError(400, 'invalidSettings');
  }
  saveSalonSettings.immediate({ openTime, closeTime, onlineJoiningEnabled });
}
