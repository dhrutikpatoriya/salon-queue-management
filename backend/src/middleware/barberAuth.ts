import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { db } from '../db/database.js';
import type { BarberRecord } from '../services/queueService.js';

const SESSION_MS = 4 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const sessions = new Map<string, { barberId: string; expiresAt: number }>();
const attempts = new Map<string, { count: number; expiresAt: number }>();

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function credentialFor(id: string): string | undefined {
  try {
    const credentials: unknown = JSON.parse(process.env.BARBER_CREDENTIALS || '{}');
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return;
    const map = credentials as Record<string, unknown>;
    const credential = Object.hasOwn(map, id) ? map[id] : undefined;
    if (typeof credential !== 'string' || credential.length < 4 || credential.length > 128) return;
    if (Object.values(map).filter((value) => value === credential).length !== 1) return;
    return credential;
  } catch {
    return;
  }
}

export const resolveBarber: RequestHandler = (req, res, next) => {
  const barber = db.prepare('SELECT * FROM barbers WHERE id = ? COLLATE NOCASE')
    .get(req.params.name) as BarberRecord | undefined;
  if (!barber) {
    res.status(404).json({ error: 'unknownBarber' });
    return;
  }
  res.locals.barberId = barber.id;
  next();
};

export const loginBarber: RequestHandler = (req, res) => {
  const barberId: string = res.locals.barberId;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.expiresAt <= now) attempts.delete(key);
  }
  const attempt = attempts.get(ip) ?? { count: 0, expiresAt: now + WINDOW_MS };
  if (attempt.count >= 5) {
    res.status(429).json({ error: 'rateLimited' });
    return;
  }

  const configured = credentialFor(barberId);
  if (!configured) {
    res.status(503).json({ error: 'credentialUnavailable' });
    return;
  }

  const credential = req.body?.credential;
  if (typeof credential !== 'string' || credential.length > 128 ||
      !timingSafeEqual(digest(credential), digest(configured))) {
    attempt.count++;
    attempts.set(ip, attempt);
    res.status(401).json({ error: 'invalidCredential' });
    return;
  }

  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key);
  }
  const token = randomBytes(32).toString('hex');
  const expiresAt = now + SESSION_MS;
  sessions.set(token, { barberId, expiresAt });
  res.set('Cache-Control', 'no-store').json({ token, expiresAt });
};

export const requireBarber: RequestHandler = (req, res, next) => {
  const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const session = token ? sessions.get(token) : undefined;
  if (!token || !session || session.expiresAt <= Date.now() || !credentialFor(session.barberId)) {
    if (token) sessions.delete(token);
    res.status(401).json({ error: 'sessionExpired' });
    return;
  }
  if (session.barberId !== res.locals.barberId) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.locals.barberToken = token;
  res.set('Cache-Control', 'no-store');
  next();
};

export const logoutBarber: RequestHandler = (_req, res) => {
  sessions.delete(res.locals.barberToken);
  res.sendStatus(204);
};
