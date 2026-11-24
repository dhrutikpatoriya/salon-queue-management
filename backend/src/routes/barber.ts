import { Router, type RequestHandler } from 'express';
import { loginBarber, logoutBarber, requireBarber, resolveBarber } from '../middleware/barberAuth.js';
import { BarberActionError, changeAssignment, changeAvailability, getBarberDashboard } from '../services/barberService.js';
import { broadcastQueueUpdate } from '../socket/socketHandler.js';

export const barberRouter = Router();
barberRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
barberRouter.use('/:name', resolveBarber);
barberRouter.post('/:name/login', loginBarber);
barberRouter.use('/:name', requireBarber);
barberRouter.post('/:name/logout', logoutBarber);
barberRouter.get('/:name/dashboard', (_req, res) => {
  res.json(getBarberDashboard(res.locals.barberId));
});

function action(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      handler(req, res, next);
      broadcastQueueUpdate();
      res.sendStatus(204);
    } catch (error) {
      if (error instanceof BarberActionError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  };
}

barberRouter.post('/:name/assignments/:id/start', action((req, res) => {
  changeAssignment(res.locals.barberId, req.params.id, 'start');
}));
barberRouter.post('/:name/assignments/:id/done', action((req, res) => {
  changeAssignment(res.locals.barberId, req.params.id, 'done');
}));
barberRouter.patch('/:name/availability', action((req, res) => {
  changeAvailability(res.locals.barberId, req.body?.status);
}));
