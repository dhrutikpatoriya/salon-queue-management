export const SALON_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in the salon's local timezone (Asia/Kolkata).
 */
export function getLocalTodayDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: SALON_TIMEZONE });
}

/**
 * Checks whether the physical salon is currently open (9:00 AM – 9:00 PM).
 * Walk-ins can register as long as the salon is open.
 */
export function isSalonOpen(): { open: boolean; reason?: string } {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: SALON_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  if (timeStr < '09:00') {
    return {
      open: false,
      reason: 'Salon is closed. Opens at 9:00 AM.'
    };
  }

  if (timeStr >= '21:00') {
    return {
      open: false,
      reason: 'Salon is closed for the day (Closed at 9:00 PM).'
    };
  }

  return { open: true };
}

/**
 * Checks whether online queue joining is allowed based on operating hours.
 * Salon is open 9:00 AM – 9:00 PM.
 * Online joining closes 30 minutes before salon closing (at 8:30 PM / 20:30).
 */
export function isOnlineJoiningAllowed(): { allowed: boolean; reason?: string } {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: SALON_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });

  if (timeStr < '09:00') {
    return {
      allowed: false,
      reason: 'Online joining is closed. Salon opens at 9:00 AM.'
    };
  }

  if (timeStr >= '20:30') {
    return {
      allowed: false,
      reason: 'Online joining is closed for today (closes at 8:30 PM, 30 minutes before salon closes).'
    };
  }

  return { allowed: true };
}
