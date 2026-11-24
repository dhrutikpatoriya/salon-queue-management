import { db } from '../db/database.js';

export interface SalonSettings {
  openTime: string;
  closeTime: string;
  onlineJoiningEnabled: boolean;
}

export const defaultSalonSettings: SalonSettings = {
  openTime: '09:00', closeTime: '21:00', onlineJoiningEnabled: true,
};
export const ONLINE_CUTOFF_MINUTES = 30;

export function timeInMinutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function validOperatingHours(openTime: unknown, closeTime: unknown): boolean {
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return typeof openTime === 'string' && typeof closeTime === 'string' &&
    time.test(openTime) && time.test(closeTime) &&
    timeInMinutes(closeTime) - timeInMinutes(openTime) > ONLINE_CUTOFF_MINUTES;
}

export function getSalonSettings(): SalonSettings {
  const rows = db.prepare(`
    SELECT key, value FROM salon_settings
    WHERE key IN ('open_time', 'close_time', 'online_joining_enabled')
  `).all() as Array<{ key: string; value: string }>;
  const values = new Map(rows.map(({ key, value }) => [key, value]));
  const openTime = values.get('open_time') ?? defaultSalonSettings.openTime;
  const closeTime = values.get('close_time') ?? defaultSalonSettings.closeTime;
  const hours = validOperatingHours(openTime, closeTime)
    ? { openTime, closeTime }
    : { openTime: defaultSalonSettings.openTime, closeTime: defaultSalonSettings.closeTime };
  return { ...hours, onlineJoiningEnabled: values.get('online_joining_enabled') !== '0' };
}

export const saveSalonSettings = db.transaction((settings: SalonSettings) => {
  const save = db.prepare('INSERT INTO salon_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  save.run('open_time', settings.openTime);
  save.run('close_time', settings.closeTime);
  save.run('online_joining_enabled', settings.onlineJoiningEnabled ? '1' : '0');
});
