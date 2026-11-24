import { Router } from 'express';
import { getDisplayData } from '../services/displayService.js';

export const displayRouter = Router();
displayRouter.get('/', (_req, res) => {
  const { snapshot, refreshAfterMs } = getDisplayData();
  res.set('Cache-Control', 'no-store').set('X-Salon-Refresh-After-Ms', String(refreshAfterMs)).json(snapshot);
});
