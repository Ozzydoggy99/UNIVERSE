import { Express, Request, Response } from 'express';
import { adminRequired, renderAdminPage, getAdminTemplatesList, getTemplateAssignments } from './admin-renderer';
import { storage } from './mem-storage';

// Admin-specific routes that render server-side
export function registerAdminRoutes(app: Express) {
  // Admin authentication middleware for all admin routes
  app.use('/admin/*', adminRequired);
  
  // Admin Dashboard Route
  app.get('/admin/dashboard', async (req: Request, res: Response) => {
    // Get data for the dashboard
    const templates = await getAdminTemplatesList();
    const templateAssignments = await getTemplateAssignments();
    const users = Array.from((await storage.getAllUsers()).values());
    
    // Send the rendered admin dashboard
    res.json({
      templates,
      templateAssignments,
      userCount: users.length,
      adminCount: users.filter(u => u.role === 'admin').length,
      regularUserCount: users.filter(u => u.role !== 'admin').length
    });
  });
  
  // Admin Templates Management
  app.get('/admin/templates', async (req: Request, res: Response) => {
    const templates = await getAdminTemplatesList();
    res.json({ templates });
  });
  
  // Get specific template
  app.get('/admin/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json({
        id: template.id,
        name: template.name,
        description: template.description,
        layout: JSON.parse(template.layout || '{}'),
        createdAt: template.createdAt
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });
  
  // Create template
  app.post('/admin/templates', async (req: Request, res: Response) => {
    try {
      const { name, description, layout } = req.body;
      
      // Validate inputs
      if (!name || !layout) {
        return res.status(400).json({ error: 'Name and layout are required' });
      }
      
      // Create the template
      const newTemplate = await storage.createTemplate({
        name,
        description: description || '',
        layout: typeof layout === 'string' ? layout : JSON.stringify(layout)
      });
      
      res.status(201).json({
        id: newTemplate.id,
        name: newTemplate.name,
        description: newTemplate.description,
        layout: JSON.parse(newTemplate.layout || '{}'),
        createdAt: newTemplate.createdAt
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });
  
  // Update template
  app.put('/admin/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const { name, description, layout } = req.body;
      
      // Check if template exists
      const existingTemplate = await storage.getTemplate(templateId);
      if (!existingTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Update the template
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (layout !== undefined) {
        updates.layout = typeof layout === 'string' ? layout : JSON.stringify(layout);
      }
      
      const updatedTemplate = await storage.updateTemplate(templateId, updates);
      
      res.json({
        id: updatedTemplate?.id,
        name: updatedTemplate?.name,
        description: updatedTemplate?.description,
        layout: JSON.parse(updatedTemplate?.layout || '{}'),
        createdAt: updatedTemplate?.createdAt
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });
  
  // Delete template
  app.delete('/admin/templates/:id', async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      
      // Check if template exists
      const existingTemplate = await storage.getTemplate(templateId);
      if (!existingTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Delete the template
      const result = await storage.deleteTemplate(templateId);
      
      if (result) {
        res.status(204).end();
      } else {
        res.status(500).json({ error: 'Failed to delete template' });
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });
  
  // Robot Template Assignments
  app.get('/admin/robot-assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getAllRobotTemplateAssignments();
      const templates = await storage.getAllTemplates();
      
      // Map template names to assignments
      const result = assignments.map(assignment => {
        const template = templates.find(t => t.id === assignment.templateId);
        return {
          ...assignment,
          templateName: template ? template.name : 'Unknown Template'
        };
      });
      
      res.json({ assignments: result });
    } catch (error) {
      console.error('Error fetching robot assignments:', error);
      res.status(500).json({ error: 'Failed to fetch robot assignments' });
    }
  });
  
  // Create robot template assignment
  app.post('/admin/robot-assignments', async (req: Request, res: Response) => {
    try {
      const { serialNumber, templateId, name, location } = req.body;
      
      // Validate inputs
      if (!serialNumber || !templateId) {
        return res.status(400).json({ error: 'Serial number and template ID are required' });
      }
      
      // Check if the template exists
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      // Create the assignment
      const newAssignment = await storage.createRobotTemplateAssignment({
        serialNumber,
        templateId,
        name: name || `Robot ${serialNumber}`,
        location: location || 'Unknown'
      });
      
      res.status(201).json(newAssignment);
    } catch (error) {
      console.error('Error creating robot assignment:', error);
      res.status(500).json({ error: 'Failed to create robot assignment' });
    }
  });
  
  // Update robot template assignment
  app.put('/admin/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const { serialNumber, templateId, name, location } = req.body;
      
      // Check if assignment exists
      const existingAssignment = await storage.getRobotTemplateAssignment(assignmentId);
      if (!existingAssignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      
      // Update the assignment
      const updates: any = {};
      if (serialNumber !== undefined) updates.serialNumber = serialNumber;
      if (templateId !== undefined) {
        // Check if the new template exists
        const template = await storage.getTemplate(templateId);
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
        updates.templateId = templateId;
      }
      if (name !== undefined) updates.name = name;
      if (location !== undefined) updates.location = location;
      
      const updatedAssignment = await storage.updateRobotTemplateAssignment(assignmentId, updates);
      
      res.json(updatedAssignment);
    } catch (error) {
      console.error('Error updating robot assignment:', error);
      res.status(500).json({ error: 'Failed to update robot assignment' });
    }
  });
  
  // Delete robot template assignment
  app.delete('/admin/robot-assignments/:id', async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.id);
      
      // Check if assignment exists
      const existingAssignment = await storage.getRobotTemplateAssignment(assignmentId);
      if (!existingAssignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      
      // Delete the assignment
      const result = await storage.deleteRobotTemplateAssignment(assignmentId);
      
      if (result) {
        res.status(204).end();
      } else {
        res.status(500).json({ error: 'Failed to delete robot assignment' });
      }
    } catch (error) {
      console.error('Error deleting robot assignment:', error);
      res.status(500).json({ error: 'Failed to delete robot assignment' });
    }
  });
  
  // Catch-all route for admin pages
  app.get('/admin/*', (req: Request, res: Response) => {
    res.redirect('/admin/dashboard');
  });
}