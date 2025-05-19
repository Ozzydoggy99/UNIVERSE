// server/dynamic-point-routes.ts
import express, { Request, Response } from 'express';
import { 
  updatePointDatabase, 
  getAllDynamicPoints, 
  getPointCoordinates,
  getAllPointDisplayMappings,
  getPointDisplayName
} from './auto-point-detection';

/**
 * Register dynamic point API routes
 */
export function registerDynamicPointRoutes(app: express.Express) {
  /**
   * GET /api/robots/points/all-dynamic
   * Get all dynamically detected points
   */
  app.get('/api/robots/points/all-dynamic', (req: Request, res: Response) => {
    try {
      const points = getAllDynamicPoints();
      res.json(points);
    } catch (error: any) {
      console.error('❌ Failed to load dynamic points:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * GET /api/robots/points/lookup/:id
   * Get coordinates for a specific point ID from either static or dynamic sources
   */
  app.get('/api/robots/points/lookup/:id', (req: Request, res: Response) => {
    try {
      const pointId = req.params.id;
      const coordinates = getPointCoordinates(pointId);
      
      if (!coordinates) {
        return res.status(404).json({ error: `Point with ID ${pointId} not found` });
      }
      
      res.json({
        id: pointId,
        ...coordinates,
        displayName: getPointDisplayName(pointId)
      });
    } catch (error: any) {
      console.error(`❌ Failed to lookup point ${req.params.id}:`, error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * GET /api/robots/points/display-mappings
   * Get all point display mappings (static + dynamic)
   */
  app.get('/api/robots/points/display-mappings', (req: Request, res: Response) => {
    try {
      const mappings = getAllPointDisplayMappings();
      res.json(mappings);
    } catch (error: any) {
      console.error('❌ Failed to load point display mappings:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  /**
   * POST /api/robots/points/refresh
   * Force refresh of the point database from the robot API
   */
  app.post('/api/robots/points/refresh', async (req: Request, res: Response) => {
    try {
      await updatePointDatabase();
      res.json({ success: true, message: 'Point database refreshed successfully' });
    } catch (error: any) {
      console.error('❌ Failed to refresh point database:', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });
}