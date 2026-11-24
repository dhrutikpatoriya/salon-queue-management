import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface StaffSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

// Session lifetime: 4 hours
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

// Rate limiting: Max 5 failed login attempts per 15 minutes per IP
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// In-memory session store and rate limiter
const staffSessions = new Map<string, StaffSession>();
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number; blockedUntil?: number }>();

/**
 * Checks whether staff credentials are configured in the environment.
 * Mandatory Correction 1: Fail closed when staff credentials are not configured.
 */
export function isStaffPinConfigured(): boolean {
  const pin = process.env.STAFF_PIN?.trim();
  return Boolean(pin && pin.length >= 4);
}

/**
 * Validates staff PIN with rate limiting and issues a short-lived cryptographic session token.
 */
export function verifyPinAndCreateSession(
  pin: string,
  ip: string
): { success: true; token: string; expiresAt: number } | { success: false; status: number; error: string } {
  // 1. Fail closed if not configured
  if (!isStaffPinConfigured()) {
    return {
      success: false,
      status: 503,
      error: 'Staff authentication is not configured on the server. Please configure STAFF_PIN.'
    };
  }

  const configuredPin = process.env.STAFF_PIN!.trim();
  const now = Date.now();

  // 2. Rate limit check per IP
  const rateRecord = loginAttempts.get(ip);
  if (rateRecord) {
    if (rateRecord.blockedUntil && now < rateRecord.blockedUntil) {
      const waitMinutes = Math.ceil((rateRecord.blockedUntil - now) / 60000);
      return {
        success: false,
        status: 429,
        error: `Too many failed login attempts. Please wait ${waitMinutes} minute(s) before trying again.`
      };
    }

    // Reset window if expired
    if (now - rateRecord.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }

  // 3. Verify PIN using constant-time comparison to prevent timing attacks
  const inputPin = (pin || '').trim();
  const isMatch =
    inputPin.length === configuredPin.length &&
    crypto.timingSafeEqual(Buffer.from(inputPin), Buffer.from(configuredPin));

  if (!isMatch) {
    // Record failed attempt
    const current = loginAttempts.get(ip) || { count: 0, firstAttemptAt: now };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.blockedUntil = now + RATE_LIMIT_WINDOW_MS;
    }
    loginAttempts.set(ip, current);

    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - current.count);
    return {
      success: false,
      status: 401,
      error: remaining > 0
        ? `Invalid staff PIN. ${remaining} attempt(s) remaining before temporary lockout.`
        : 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
    };
  }

  // 4. Successful login: Clear rate limiter
  loginAttempts.delete(ip);

  // 5. Generate secure random session token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = now + SESSION_TTL_MS;

  const session: StaffSession = {
    token,
    createdAt: now,
    expiresAt,
    ip
  };

  staffSessions.set(token, session);

  return {
    success: true,
    token,
    expiresAt
  };
}

/**
 * Validates a staff session token.
 */
export function verifyStaffSession(token?: string): StaffSession | null {
  if (!token) return null;
  const session = staffSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    staffSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Revokes a staff session (logout).
 */
export function revokeStaffSession(token: string): boolean {
  return staffSessions.delete(token);
}

/**
 * Express middleware to enforce staff authentication on protected endpoints.
 */
export function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const staffToken = (req.headers['x-staff-token'] as string) || tokenFromHeader;

  const session = verifyStaffSession(staffToken);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Staff authentication required or session expired. Please log in.'
    });
  }

  // Attach session to request for downstream handlers
  (req as any).staffSession = session;
  next();
}

/**
 * Utility to clear all sessions and rate limits (useful for test isolation).
 */
export function resetStaffAuthStoreForTesting() {
  staffSessions.clear();
  loginAttempts.clear();
}
