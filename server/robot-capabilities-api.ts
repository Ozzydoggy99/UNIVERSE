/**
 * Robot Capabilities API
 * 
 * This module provides API endpoints for retrieving robot capabilities,
 * including maps, shelf points, and supported service types.
 */

import { Express } from 'express';
import { logger } from './logger';
import { storage } from './storage';
import { discoverRobotCapabilities, updateTemplateWithRobotCapabilities } from './robot-template-discovery';
import { isAuthenticated } from './auth-middleware';
import { robotPointsMap } from './robot-points-map';

/**
 * Registers the robot capabilities API routes
 */
export function registerRobotCapabilitiesAPI(app: Express): void {
  logger.info('[ROBOT-CAPABILITIES-API] Registering robot capabilities API routes');
  
  // Endpoint to fetch available maps and shelf points for workflows
  app.get('/api/workflow/maps', isAuthenticated, async (req, res) => {
    try {
      logger.info('[ROBOT-CAPABILITIES-API] Fetching map data for workflows');
      
      // Get user's template from the authenticated user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }
      
      // Find the template ID assigned to the user
      const userTemplate = await storage.getUserTemplate(userId);
      if (!userTemplate) {
        return res.status(404).json({ success: false, error: 'No template assigned to user' });
      }
      
      // Get the template
      const template = await storage.getTemplate(userTemplate.templateId);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      
      // Check if the template has robot capabilities (if not, needs to be discovered)
      if (!template.config?.robotCapabilities) {
        // Find a robot assigned to this template
        const robotAssignment = await storage.getTemplateRobotAssignment(template.id);
        if (!robotAssignment) {
          // No robot assigned, so do a direct discovery from robot API
          logger.info('[ROBOT-CAPABILITIES-API] No robot assignment found, fetching map data directly');
          
          // Fetch points directly from the robot
          const points = await robotPointsMap.fetchRobotMapPoints();
          
          // Format the data for the response
          const floorMap = {
            id: '1',
            name: 'Floor 1',
            shelfPoints: []
          };
          
          // Process points to build shelf points list
          for (const [pointId, pointData] of Object.entries(points)) {
            // Skip non-shelf points, charger points, and docking points
            if (
              !pointId.includes('_load') || 
              pointId.includes('pick-up') || 
              pointId.includes('drop-off') ||
              pointId.toLowerCase().includes('charger') ||
              pointId.endsWith('_docking')
            ) {
              continue;
            }
            
            // Extract display name (e.g., "104" from "104_load")
            let displayName = pointId;
            const match = pointId.match(/^(\d+)_/);
            if (match) {
              displayName = match[1];
            }
            
            floorMap.shelfPoints.push({
              id: pointId,
              displayName,
              x: pointData.x,
              y: pointData.y
            });
          }
          
          // Sort shelf points numerically
          floorMap.shelfPoints.sort((a, b) => {
            const numA = parseInt(a.displayName);
            const numB = parseInt(b.displayName);
            if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB;
            }
            return a.displayName.localeCompare(b.displayName);
          });
          
          return res.json({ success: true, maps: [floorMap] });
        }
        
        // Robot assigned, discover capabilities and update template
        try {
          await updateTemplateWithRobotCapabilities(storage, template.id, robotAssignment.robotId);
          
          // Get the updated template
          const updatedTemplate = await storage.getTemplate(template.id);
          if (!updatedTemplate?.config?.robotCapabilities) {
            throw new Error('Failed to discover robot capabilities');
          }
          
          template.config = updatedTemplate.config;
        } catch (error) {
          logger.error(`[ROBOT-CAPABILITIES-API] Error updating robot capabilities: ${error}`);
          // Continue with direct map fallback
        }
      }
      
      // Use the capabilities from the template if available
      if (template.config?.robotCapabilities) {
        const { maps } = template.config.robotCapabilities;
        
        // Format the maps data for the frontend
        const formattedMaps = maps.map(map => ({
          id: map.floorNumber.toString(),
          name: `Floor ${map.floorNumber}`,
          shelfPoints: map.shelfPoints.map(point => ({
            id: point.id,
            displayName: point.displayName,
            x: point.x,
            y: point.y
          }))
        }));
        
        return res.json({ success: true, maps: formattedMaps });
      } else {
        // Fallback if capabilities not available
        logger.warn('[ROBOT-CAPABILITIES-API] No robot capabilities found in template, fetching directly');
        
        // Fetch points directly from the robot
        const points = await robotPointsMap.fetchRobotMapPoints();
        
        // Format the data for the response
        const floorMap = {
          id: '1',
          name: 'Floor 1',
          shelfPoints: []
        };
        
        // Process points to build shelf points list
        for (const [pointId, pointData] of Object.entries(points)) {
          // Skip non-shelf points, charger points, and docking points
          if (
            !pointId.includes('_load') || 
            pointId.includes('pick-up') || 
            pointId.includes('drop-off') ||
            pointId.toLowerCase().includes('charger') ||
            pointId.endsWith('_docking')
          ) {
            continue;
          }
          
          // Extract display name (e.g., "104" from "104_load")
          let displayName = pointId;
          const match = pointId.match(/^(\d+)_/);
          if (match) {
            displayName = match[1];
          }
          
          floorMap.shelfPoints.push({
            id: pointId,
            displayName,
            x: pointData.x,
            y: pointData.y
          });
        }
        
        // Sort shelf points numerically
        floorMap.shelfPoints.sort((a, b) => {
          const numA = parseInt(a.displayName);
          const numB = parseInt(b.displayName);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return a.displayName.localeCompare(b.displayName);
        });
        
        return res.json({ success: true, maps: [floorMap] });
      }
    } catch (error) {
      logger.error(`[ROBOT-CAPABILITIES-API] Error fetching maps: ${error}`);
      return res.status(500).json({ success: false, error: 'Error fetching map data' });
    }
  });
  
  // Endpoint for admins to manually trigger capabilities discovery for a template
  app.post('/api/admin/templates/:templateId/discover-capabilities', isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }
      
      const templateId = parseInt(req.params.templateId);
      if (isNaN(templateId)) {
        return res.status(400).json({ success: false, error: 'Invalid template ID' });
      }
      
      // Get the template
      const template = await storage.getTemplate(templateId);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      
      // Find a robot assigned to this template
      const robotAssignment = await storage.getTemplateRobotAssignment(templateId);
      if (!robotAssignment) {
        return res.status(404).json({ success: false, error: 'No robot assigned to this template' });
      }
      
      // Discover robot capabilities and update the template
      await updateTemplateWithRobotCapabilities(storage, templateId, robotAssignment.robotId);
      
      return res.json({ success: true, message: 'Template capabilities updated successfully' });
    } catch (error) {
      logger.error(`[ROBOT-CAPABILITIES-API] Error updating template capabilities: ${error}`);
      return res.status(500).json({ success: false, error: 'Error updating template capabilities' });
    }
  });
  
  // Endpoint to fetch service types for a template
  app.get('/api/workflow/service-types', isAuthenticated, async (req, res) => {
    try {
      logger.info('[ROBOT-CAPABILITIES-API] Fetching service types');
      
      // Get user's template from the authenticated user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }
      
      // Find the template ID assigned to the user
      const userTemplate = await storage.getUserTemplate(userId);
      if (!userTemplate) {
        return res.status(404).json({ success: false, error: 'No template assigned to user' });
      }
      
      // Get the template
      const template = await storage.getTemplate(userTemplate.templateId);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      
      // Use the service types from the template if available
      if (template.config?.robotCapabilities?.serviceTypes) {
        return res.json({ 
          success: true, 
          serviceTypes: template.config.robotCapabilities.serviceTypes
        });
      } else {
        // Fallback to default service types if none defined
        const defaultServiceTypes = [
          {
            id: 'laundry',
            displayName: 'Laundry',
            icon: 'ShowerHead',
            enabled: true
          },
          {
            id: 'trash',
            displayName: 'Trash',
            icon: 'Trash2',
            enabled: true
          }
        ];
        
        return res.json({ success: true, serviceTypes: defaultServiceTypes });
      }
    } catch (error) {
      logger.error(`[ROBOT-CAPABILITIES-API] Error fetching service types: ${error}`);
      return res.status(500).json({ success: false, error: 'Error fetching service types' });
    }
  });
  
  logger.info('[ROBOT-CAPABILITIES-API] Robot capabilities API routes registered');
}