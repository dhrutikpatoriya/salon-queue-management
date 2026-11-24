import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { db } from '../db/database.js';
import { credentialVersion, verifyAccount } from '../services/credentialService.js';
import { createAuthLimiter } from '../utils/authLimiter.js';
import type { BarberRecord } from '../services/queueService.js';

const SESSION_MS = 4 * 60 * 60 * 1000;
const sessions = new Map<string, { barberId: string; expiresAt: number; version: string }>();
const attempts = createAuthLimiter();

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

export const loginBarber: RequestHandler = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const barberId: string = res.locals.barberId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!attempts.take(ip)) {
      res.status(429).json({ error: 'rateLimited' });
      return;
    }
    const credential = req.body?.credential;
    const verified = await verifyAccount(`barber:${barberId}`, typeof credential === 'string' && credential.length <= 128 ? credential : undefined);
    if (verified.status === 'unavailable') {
      attempts.refund(ip);
      res.status(503).json({ error: 'credentialUnavailable' });
      return;
    }
    if (verified.status !== 'valid') {
      res.status(401).json({ error: 'invalidCredential' });
      return;
    }
    attempts.refund(ip);
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(key);
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = now + SESSION_MS;
    sessions.set(token, { barberId, expiresAt, version: verified.version });
    res.json({ token, expiresAt });
  } catch (error) { next(error); }
};

export const requireBarber: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const session = token ? sessions.get(token) : undefined;
  if (!token || !session || session.expiresAt <= Date.now() ||
      session.version !== credentialVersion(`barber:${session.barberId}`)) {
    if (token) sessions.delete(token);
    res.status(401).json({ error: 'sessionExpired' });
    return;
  }
  if (session.barberId !== res.locals.barberId) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  res.locals.barberToken = token;
  next();
};

export const logoutBarber: RequestHandler = (_req, res) => {
  sessions.delete(res.locals.barberToken);
  res.sendStatus(204);
};
