import { Router, type RequestHandler } from 'express';
import { parseDays, type DashboardService } from './dashboard.service.js';

export function createDashboardRouter(service: DashboardService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.get('/api/dashboard', requireAuth, (req, res) => {
    const days = parseDays(req.query['days']);
    res.json(service.getDashboard(req.user!.id, days));
  });

  return router;
}
