import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { credentialVersion, verifyAccount } from '../services/credentialService.js';
import { createAuthLimiter } from '../utils/authLimiter.js';

const sessionLifetime = 4 * 60 * 60 * 1000;
const staffSessions = new Map<string, { expiresAt: number; version: string }>();
const attempts = createAuthLimiter();

export async function verifyPinAndCreateSession(pin: unknown, ip: string) {
  if (!attempts.take(ip)) return { success: false, status: 429, error: 'Too many failed login attempts. Try again later.' } as const;
  const verified = await verifyAccount('reception', pin);
  if (verified.status === 'unavailable') {
    attempts.refund(ip);
    return { success: false, status: 503, error: 'Staff authentication is not configured on the server.' } as const;
  }
  if (verified.status !== 'valid') return { success: false, status: 401, error: 'Invalid staff PIN.' } as const;

  attempts.reset(ip);
  const now = Date.now();
  for (const [key, session] of staffSessions) {
    if (session.expiresAt <= now || session.version !== verified.version) staffSessions.delete(key);
  }
  const token = randomBytes(32).toString('hex');
  const expiresAt = now + sessionLifetime;
  staffSessions.set(token, { expiresAt, version: verified.version });
  return { success: true, token, expiresAt } as const;
}

export function verifyStaffSession(token?: string) {
  if (!token) return null;
  const session = staffSessions.get(token);
  if (!session || session.expiresAt <= Date.now() || session.version !== credentialVersion('reception')) {
    staffSessions.delete(token);
    return null;
  }
  return session;
}

export function revokeStaffSession(token: string) {
  return staffSessions.delete(token);
}

export function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-store');
  const fromHeader = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const session = verifyStaffSession(req.get('x-staff-token') || fromHeader);
  if (!session) {
    res.status(401).json({ success: false, error: 'Staff authentication required or session expired. Please log in.' });
    return;
  }
  res.locals.staffSession = session;
  next();
}

export function resetStaffAuthStoreForTesting() {
  staffSessions.clear();
  attempts.clear();
}
