// server/mission-routes.ts
import express, { Request, Response } from 'express';
import { missionQueue } from './mission-queue';

const router = express.Router();

// Get all missions
router.get('/missions', (req: Request, res: Response) => {
  const missions = missionQueue.getAllMissions();
  res.json(missions);
});

// Get active missions
router.get('/missions/active', (req: Request, res: Response) => {
  const missions = missionQueue.getActiveMissions();
  res.json(missions);
});

// Get completed missions
router.get('/missions/completed', (req: Request, res: Response) => {
  const missions = missionQueue.getCompletedMissions();
  res.json(missions);
});

// Get failed missions
router.get('/missions/failed', (req: Request, res: Response) => {
  const missions = missionQueue.getFailedMissions();
  res.json(missions);
});

// Get a specific mission by ID
router.get('/missions/:id', (req: Request, res: Response) => {
  const mission = missionQueue.getMission(req.params.id);
  
  if (!mission) {
    return res.status(404).json({ error: 'Mission not found' });
  }
  
  res.json(mission);
});

// Clear completed and failed missions
router.post('/missions/clear-completed', (req: Request, res: Response) => {
  missionQueue.clearCompletedMissions();
  res.json({ success: true, message: 'Completed and failed missions cleared' });
});

export const missionRouter = router;