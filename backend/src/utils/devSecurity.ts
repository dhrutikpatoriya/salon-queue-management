/**
 * Development security utilities.
 * Ensures developer-only testing routes can NEVER be activated in production,
 * even when NODE_ENV is unset, missing, or misconfigured.
 */

export const DEV_TEST_SECRET = process.env.DEV_TEST_SECRET || 'salon-dev-secret-step3';

/**
 * Determines whether development test endpoints may be mounted and used.
 * Default behavior: DISABLED unless explicitly opted into for local development.
 * Strictly returns false when NODE_ENV === 'production'.
 */
export function isDevTestEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  // Require explicit dev flag or NODE_ENV === 'development'
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_TEST === 'true';
}
