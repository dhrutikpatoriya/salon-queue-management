import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Hosted credentials come only from the service environment.
if (process.env.NODE_ENV !== 'production' && process.env.RENDER !== 'true') {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
  dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
}

export const production = process.env.NODE_ENV === 'production';
if (process.env.RENDER === 'true' && !production) {
  throw new Error('Render requires NODE_ENV=production');
}

function publicOrigin() {
  if (!production) return undefined;
  const value = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  try {
    const url = new URL(value || '');
    if (url.protocol === 'https:' && (value === url.origin || value === url.origin + '/')) return url.origin;
  } catch {
    // Report configuration errors without including the provided value.
  }
  throw new Error('Production requires one HTTPS origin in PUBLIC_ORIGIN or RENDER_EXTERNAL_URL');
}

export const allowedOrigin = publicOrigin();

export function permitsOrigin(origin: string | undefined) {
  return !production || origin === undefined || origin === allowedOrigin;
}
