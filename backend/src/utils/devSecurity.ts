import { createHash, timingSafeEqual } from 'node:crypto';

export function isDevTestEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_TEST === 'true';
}

export function matchesDevTestSecret(submitted: unknown): boolean {
  const secret = process.env.DEV_TEST_SECRET;
  if (!secret || secret.trim().length < 32 || typeof submitted !== 'string' ||
      submitted.length !== secret.length) return false;

  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(secret), digest(submitted));
}
