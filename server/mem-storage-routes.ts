import express, { Router, Request, Response } from 'express';
import { storage } from './mem-storage';

const router: Router = express.Router();

// User routes
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Template routes
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await storage.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const template = await storage.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const newTemplate = req.body;
    
    if (!newTemplate || !newTemplate.name) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    const createdTemplate = await storage.createTemplate(newTemplate);
    res.status(201).json(createdTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const templateUpdate = req.body;
    
    if (!templateUpdate || typeof templateUpdate !== 'object') {
      return res.status(400).json({ error: 'Invalid template data' });
    }
    
    const updatedTemplate = await storage.updateTemplate(id, templateUpdate);
    
    if (!updatedTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = await storage.deleteTemplate(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Robot template assignment routes
router.get('/robot-assignments', async (req: Request, res: Response) => {
  try {
    const assignments = await storage.getAllRobotTemplateAssignments();
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching robot assignments:', error);
    res.status(500).json({ error: 'Failed to fetch robot assignments' });
  }
});

// Robot status history routes
router.get('/robot-status/:robotId', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = await storage.getRobotStatusHistory(robotId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching robot status history:', error);
    res.status(500).json({ error: 'Failed to fetch robot status history' });
  }
});

// Sensor readings routes
router.get('/sensor-readings/:robotId', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const readings = await storage.getSensorReadings(robotId, limit);
    res.json(readings);
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    res.status(500).json({ error: 'Failed to fetch sensor readings' });
  }
});

// Position history routes
router.get('/position-history/:robotId', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = await storage.getPositionHistory(robotId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching position history:', error);
    res.status(500).json({ error: 'Failed to fetch position history' });
  }
});

export const memStorageRouter = router; 