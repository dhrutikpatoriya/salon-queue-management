import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { credentialVersion, verifyAccount } from '../services/credentialService.js';
import { createAuthLimiter } from '../utils/authLimiter.js';

const sessionLifetime = 4 * 60 * 60 * 1000;
const sessions = new Map<string, { expiresAt: number; version: string }>();
const failures = createAuthLimiter();

export const loginOwner: RequestHandler = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!failures.take(ip)) {
      res.status(429).json({ error: 'rateLimited' });
      return;
    }
    const verified = await verifyAccount('owner', req.body?.password);
    if (verified.status === 'unavailable') {
      failures.refund(ip);
      res.status(503).json({ error: 'credentialUnavailable' });
      return;
    }
    if (verified.status !== 'valid') {
      res.status(401).json({ error: 'invalidCredential' });
      return;
    }
    failures.reset(ip);
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now || session.version !== verified.version) sessions.delete(token);
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = now + sessionLifetime;
    sessions.set(token, { expiresAt, version: verified.version });
    res.json({ token, expiresAt });
  } catch (error) { next(error); }
};

export function currentOwnerSession(token: string) {
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now() || session.version !== credentialVersion('owner')) {
    sessions.delete(token);
    return;
  }
  return session;
}

export const requireOwner: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || !currentOwnerSession(token)) {
    res.status(401).json({ error: 'sessionExpired' });
    return;
  }
  res.locals.ownerToken = token;
  next();
};

export const logoutOwner: RequestHandler = (_req, res) => {
  sessions.delete(res.locals.ownerToken);
  res.sendStatus(204);
};
