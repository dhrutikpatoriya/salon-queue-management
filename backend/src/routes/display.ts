import { Router } from 'express';
import { getDisplayData } from '../services/displayService.js';

export const displayRouter = Router();
displayRouter.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store').json(getDisplayData());
});
