import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

export const onRailway = Boolean(process.env.RAILWAY_PROJECT_ID);
const host = onRailway ? 'Railway' : process.env.RENDER === 'true' ? 'Render' : undefined;

// Hosted credentials come only from the service environment.
if (process.env.NODE_ENV !== 'production' && !host) {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
  dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
}

export const production = process.env.NODE_ENV === 'production';
if (host && !production) {
  throw new Error(`${host} requires NODE_ENV=production`);
}

function publicOrigin() {
  if (!production) return undefined;
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const value = process.env.PUBLIC_ORIGIN ||
    (onRailway && railwayDomain ? `https://${railwayDomain}` : process.env.RENDER_EXTERNAL_URL);
  try {
    const url = new URL(value || '');
    if (url.protocol === 'https:' && (value === url.origin || value === url.origin + '/')) return url.origin;
  } catch {
    // Report configuration errors without including the provided value.
  }
  throw new Error('Production requires one HTTPS origin in PUBLIC_ORIGIN or the hosting domain');
}

export const allowedOrigin = publicOrigin();

export function permitsOrigin(origin: string | undefined) {
  return !production || origin === undefined || origin === allowedOrigin;
}
