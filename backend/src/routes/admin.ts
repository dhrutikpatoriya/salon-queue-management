import { Router, type Request, type RequestHandler } from 'express';
import { loginOwner, logoutOwner, requireOwner } from '../middleware/ownerAuth.js';
import { AdminError, getOwnerDashboard, saveService, setBarberDuty, updateSalonSettings } from '../services/adminService.js';
import { broadcastQueueUpdate } from '../socket/socketHandler.js';

export const adminRouter = Router();
adminRouter.post('/login', loginOwner);
adminRouter.use(requireOwner);
adminRouter.post('/logout', logoutOwner);
adminRouter.get('/dashboard', (_req, res) => res.json(getOwnerDashboard()));

function mutation(save: (req: Request) => string | void, created = false): RequestHandler {
  return (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        throw new AdminError(400, 'invalidRequest');
      }
      const id = save(req);
      broadcastQueueUpdate();
      if (created) res.status(201).json({ id });
      else res.sendStatus(204);
    } catch (error) {
      if (error instanceof AdminError) res.status(error.status).json({ error: error.message });
      else next(error);
    }
  };
}

adminRouter.post('/services', mutation((req) => saveService.immediate(req.body), true));
adminRouter.patch('/services/:id', mutation((req) => saveService.immediate(req.body, req.params.id)));
adminRouter.patch('/barbers/:id/duty', mutation((req) => setBarberDuty.immediate(req.params.id, req.body.onDuty)));
adminRouter.patch('/settings', mutation((req) => updateSalonSettings(req.body)));
