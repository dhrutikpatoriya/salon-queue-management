import type { RequestHandler } from 'express';
import { currentOwnerSession } from '../middleware/ownerAuth.js';
import { changeAccountCredential, CredentialError, verifyAccount, type AccountId } from '../services/credentialService.js';
import { createAuthLimiter } from '../utils/authLimiter.js';

const changeAttempts = createAuthLimiter(10);

export const updateOwnerManagedCredential: RequestHandler = async (req, res, next) => {
  const token: string = res.locals.ownerToken;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!changeAttempts.take(ip)) {
    res.status(429).json({ error: 'rateLimited' });
    return;
  }

  try {
    const { currentOwnerPassword, credential, confirmation } = req.body ?? {};
    const verified = await verifyAccount('owner', currentOwnerPassword);
    if (verified.status !== 'valid' || currentOwnerSession(token)?.version !== verified.version) {
      res.status(403).json({ error: 'reauthenticationFailed' });
      return;
    }
    // The password is verified for this operation only, including an owner password change.
    await changeAccountCredential(req.params.id as AccountId, credential, confirmation, verified.version,
      () => currentOwnerSession(token)?.version === verified.version);
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof CredentialError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
};
