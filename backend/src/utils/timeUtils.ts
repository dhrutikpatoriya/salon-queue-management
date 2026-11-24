import { getSalonSettings, ONLINE_CUTOFF_MINUTES, timeInMinutes } from '../services/salonSettingsService.js';

export const SALON_TIMEZONE = 'Asia/Kolkata';

export function getLocalTodayDate(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: SALON_TIMEZONE });
}

function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function englishClock(value: string) {
  const hour = Number(value.slice(0, 2));
  return `${hour % 12 || 12}:${value.slice(3)} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function getSalonOperatingStatus(now = new Date()) {
  const settings = getSalonSettings();
  const time = now.toLocaleTimeString('en-GB', { timeZone: SALON_TIMEZONE, hourCycle: 'h23' });
  const minute = timeInMinutes(time.slice(0, 5));
  const elapsedMs = minute * 60_000 + Number(time.slice(6, 8)) * 1000 + now.getMilliseconds();
  const opens = timeInMinutes(settings.openTime);
  const closes = timeInMinutes(settings.closeTime);
  const cutoff = closes - ONLINE_CUTOFF_MINUTES;
  const cutoffTime = clockLabel(cutoff);
  const salonOpen = minute >= opens && minute < closes;
  const reasonCode: 'beforeOpening' | 'afterClosing' | 'onlineDisabled' | 'onlineCutoff' | null = minute < opens ? 'beforeOpening'
    : minute >= closes ? 'afterClosing'
    : !settings.onlineJoiningEnabled ? 'onlineDisabled'
    : minute >= cutoff ? 'onlineCutoff'
    : null;
  const nextBoundary = [opens, cutoff, closes, 1440].find((value) => value > minute) ?? 1440;
  return {
    ...settings,
    salonOpen,
    cutoffTime,
    isOnlineJoiningOpen: reasonCode === null,
    reasonCode,
    refreshAfterMs: nextBoundary * 60_000 - elapsedMs,
  };
}

export function isSalonOpen(now = new Date()): { open: boolean; reason?: string } {
  const status = getSalonOperatingStatus(now);
  return { open: status.salonOpen, reason: getPhysicalClosureReason(status) };
}

export function getPhysicalClosureReason(status: ReturnType<typeof getSalonOperatingStatus>) {
  if (status.salonOpen) return;
  return status.reasonCode === 'beforeOpening'
    ? `Salon is closed. Opens at ${englishClock(status.openTime)}.`
    : `Salon is closed for the day (Closed at ${englishClock(status.closeTime)}).`;
}

export function isOnlineJoiningAllowed(now = new Date()) {
  const status = getSalonOperatingStatus(now);
  return {
    allowed: status.isOnlineJoiningOpen,
    reason: getOnlineClosureReason(status),
    reasonCode: status.reasonCode,
  };
}

export function getOnlineClosureReason(status: ReturnType<typeof getSalonOperatingStatus>) {
  if (!status.reasonCode) return;
  const reasons = {
    beforeOpening: `Online joining is closed. Salon opens at ${englishClock(status.openTime)}.`,
    afterClosing: `Online joining is closed. Salon closed at ${englishClock(status.closeTime)}.`,
    onlineDisabled: 'Online joining is disabled by the salon.',
    onlineCutoff: `Online joining is closed for today (closes at ${englishClock(status.cutoffTime)}, 30 minutes before salon closes).`,
  };
  return reasons[status.reasonCode];
}
