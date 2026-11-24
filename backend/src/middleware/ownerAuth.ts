import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const sessionLifetime = 4 * 60 * 60 * 1000;
const attemptWindow = 15 * 60 * 1000;
const sessions = new Map<string, number>();
const failures = new Map<string, { count: number; expiresAt: number }>();

function configuredPassword() {
  const password = process.env.OWNER_PASSWORD;
  if (!password || password.length < 12 || password.length > 256) return;
  if (password === process.env.STAFF_PIN?.trim()) return;
  try {
    const barbers: unknown = JSON.parse(process.env.BARBER_CREDENTIALS ?? '{}');
    if (barbers && typeof barbers === 'object' && Object.values(barbers).includes(password)) return;
  } catch {
    // Invalid barber configuration cannot authorize a barber.
  }
  return password;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export const loginOwner: RequestHandler = (req, res) => {
  res.set('Cache-Control', 'no-store');
  const now = Date.now();
  for (const [ip, record] of failures) {
    if (record.expiresAt <= now) failures.delete(ip);
  }
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = failures.get(ip);
  if (previous && previous.count >= 5) {
    res.status(429).json({ error: 'rateLimited' });
    return;
  }
  const password = configuredPassword();
  if (!password) {
    res.status(503).json({ error: 'credentialUnavailable' });
    return;
  }
  const submitted = req.body?.password;
  if (typeof submitted !== 'string' || submitted.length > 256 ||
      !timingSafeEqual(digest(password), digest(submitted))) {
    failures.set(ip, { count: (previous?.count ?? 0) + 1, expiresAt: previous?.expiresAt ?? now + attemptWindow });
    res.status(401).json({ error: 'invalidCredential' });
    return;
  }
  failures.delete(ip);
  const token = randomBytes(32).toString('hex');
  const expiresAt = now + sessionLifetime;
  sessions.set(token, expiresAt);
  res.json({ token, expiresAt });
};

export const requireOwner: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || (sessions.get(token) ?? 0) <= Date.now() || !configuredPassword()) {
    if (token) sessions.delete(token);
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
