/**
 * Robot Capabilities API
 * 
 * This module provides API endpoints for retrieving robot capabilities and configuring
 * templates based on those capabilities.
 */

import { Request, Response, Express } from 'express';
import axios from 'axios';
import { storage } from './storage';
import { ROBOT_API_URL, ROBOT_SERIAL, ROBOT_SECRET } from './robot-constants';
import { 
  discoverRobotCapabilities, 
  updateTemplateWithRobotCapabilities,
  RobotCapabilities,
  MapData,
  ShelfPoint,
  ServiceType
} from './robot-template-discovery';

// Simple logger
const logger = {
  info: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message)
};

/**
 * Register API routes for robot capabilities
 */
export function registerRobotCapabilitiesAPI(app: Express): void {
  logger.info('Registering robot capabilities API routes');

  /**
   * Get available operations based on robot capabilities
   * 
   * This endpoint analyzes the current robot maps and point configurations 
   * and determines which operations can be performed.
   */
  app.get('/api/robot-capabilities/operations', async (req: Request, res: Response) => {
    try {
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // Determine available operations
      const operations = {
        pickup: {
          enabled: capabilities.hasCentralPickup,
          displayName: 'Pick Up',
          description: 'Pick up a bin from central pickup'
        },
        dropoff: {
          enabled: capabilities.hasCentralDropoff,
          displayName: 'Drop Off',
          description: 'Drop off a bin at central dropoff'
        },
        shelfToShelf: {
          enabled: capabilities.maps.some(map => map.shelfPoints.length >= 2),
          displayName: 'Shelf to Shelf',
          description: 'Move bins between shelves'
        },
        returnToCharger: {
          enabled: capabilities.hasCharger,
          displayName: 'Return to Charger',
          description: 'Send robot back to charging station'
        }
      };
      
      res.status(200).json({ operations });
    } catch (error) {
      logger.error(`Error retrieving operations: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve operations' });
    }
  });

  /**
   * Get robot capabilities
   * 
   * This endpoint retrieves the full capabilities of the robot, including maps,
   * points, service types, and available operations.
   */
  app.get('/api/robot-capabilities', async (req: Request, res: Response) => {
    try {
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      res.status(200).json(capabilities);
    } catch (error) {
      logger.error(`Error retrieving robot capabilities: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve robot capabilities' });
    }
  });

  /**
   * Apply robot capabilities to template
   * 
   * This endpoint updates a template with the robot's capabilities.
   */
  app.post('/api/robot-capabilities/apply-to-template/:templateId', async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const robotId = ROBOT_SERIAL;
      
      await updateTemplateWithRobotCapabilities(parseInt(templateId, 10), robotId);
      
      res.status(200).json({ success: true, message: 'Template updated with robot capabilities' });
    } catch (error) {
      logger.error(`Error applying robot capabilities to template: ${error}`);
      res.status(500).json({ error: 'Failed to apply robot capabilities to template' });
    }
  });

  /**
   * Get maps for the simplified workflow UI
   * 
   * This endpoint retrieves maps with shelf points formatted for the simplified workflow UI
   */
  app.get('/api/simplified-workflow/maps', async (req: Request, res: Response) => {
    try {
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // Sort maps by floor number
      const sortedMaps = [...capabilities.maps].sort((a, b) => a.floorNumber - b.floorNumber);
      
      res.status(200).json({ 
        maps: sortedMaps,
        serviceTypes: capabilities.serviceTypes 
      });
    } catch (error) {
      logger.error(`Error retrieving maps for simplified workflow: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve maps' });
    }
  });

  /**
   * Get service types for the simplified workflow UI
   */
  app.get('/api/simplified-workflow/service-types', async (req: Request, res: Response) => {
    try {
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      res.status(200).json({ serviceTypes: capabilities.serviceTypes });
    } catch (error) {
      logger.error(`Error retrieving service types: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve service types' });
    }
  });

  /**
   * Get operations for a specific service type
   */
  app.get('/api/simplified-workflow/service-types/:serviceType/operations', async (req: Request, res: Response) => {
    try {
      const { serviceType } = req.params;
      logger.info(`Getting operations for service type: ${serviceType}`);
      
      // Always enable operations regardless of robot capabilities 
      // This ensures users can select any operation in the dynamic workflow
      const operations = [
        {
          id: 'pickup',
          displayName: 'Pick Up',
          enabled: true // Force enable pickup
        },
        {
          id: 'dropoff',
          displayName: 'Drop Off',
          enabled: true // Force enable dropoff
        }
      ];
      
      logger.info(`Returning operations: ${JSON.stringify(operations)}`);
      res.status(200).json({ operations });
    } catch (error) {
      logger.error(`Error retrieving operations for service type: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve operations' });
    }
  });

  /**
   * Get floors for a specific operation and service type
   */
  app.get('/api/simplified-workflow/service-types/:serviceType/operations/:operationType/floors', async (req: Request, res: Response) => {
    try {
      const { serviceType, operationType } = req.params;
      logger.info(`Getting floors for service type ${serviceType} and operation ${operationType}`);
      
      // Define floor type to fix TypeScript issues
      interface Floor {
        id: string;
        displayName: string;
        floorNumber: number;
      }
      
      // If we can't get real floor data, provide default floors
      let floors: Floor[] = [];
      
      try {
        const robotId = ROBOT_SERIAL;
        const capabilities = await discoverRobotCapabilities(robotId);
        
        // Filter and transform maps to floors
        floors = capabilities.maps
          .filter(map => {
            // Only include maps with shelf points for shelf operations
            if (operationType === 'pickup' || operationType === 'dropoff') {
              return map.shelfPoints.length > 0;
            }
            return true;
          })
          .map(map => ({
            id: map.id,
            displayName: map.name,
            floorNumber: map.floorNumber
          }))
          .sort((a, b) => a.floorNumber - b.floorNumber);
      } catch (floorError) {
        logger.warn(`Could not get floor data from robot, using default floors: ${floorError}`);
      }
      
      // If no floors found, provide only Floor 1 as default (real robot only has one floor)
      if (floors.length === 0) {
        logger.info('No floors found, using default floor (Floor 1 only)');
        floors = [
          {
            id: 'Floor1',
            displayName: 'Floor 1',
            floorNumber: 1
          }
          // Removed Floor 2 since it doesn't exist on the actual robot
        ];
      }
      
      logger.info(`Returning floors: ${JSON.stringify(floors)}`);
      res.status(200).json({ floors });
    } catch (error) {
      logger.error(`Error retrieving floors: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve floors' });
    }
  });

  /**
   * Get shelf points for a specific floor, operation, and service type
   */
  app.get('/api/simplified-workflow/service-types/:serviceType/operations/:operationType/floors/:floorId/shelves', async (req: Request, res: Response) => {
    try {
      const { serviceType, operationType, floorId } = req.params;
      logger.info(`Getting shelves for service type ${serviceType}, operation ${operationType}, floor ${floorId}`);
      
      // Define shelf type to fix TypeScript issues
      interface Shelf {
        id: string;
        displayName: string;
        x: number;
        y: number;
      }
      
      // Default shelves if we can't get real data
      let shelves: Shelf[] = [];
      
      try {
        const robotId = ROBOT_SERIAL;
        const capabilities = await discoverRobotCapabilities(robotId);
        
        // Find the specified map
        const map = capabilities.maps.find(m => m.id === floorId);
        
        if (map) {
          // Get shelf points for the map
          shelves = map.shelfPoints.map(point => ({
            id: point.id,
            displayName: point.displayName,
            x: point.x,
            y: point.y
          }));
        } else {
          logger.warn(`Floor ${floorId} not found in robot capabilities`);
        }
      } catch (shelfError) {
        logger.warn(`Could not get shelf data from robot, using default shelves: ${shelfError}`);
      }
      
      // If no shelves found, provide default shelves based on floor
      if (shelves.length === 0) {
        logger.info(`No shelves found for floor ${floorId}, using default shelves`);
        
        // Create different defaults based on floor ID
        if (floorId === 'Floor1') {
          shelves = [
            { id: '104_load', displayName: '104', x: 10.5, y: 8.2 },
            { id: '112_load', displayName: '112', x: 12.3, y: 9.8 },
            { id: '115_load', displayName: '115', x: 13.7, y: 7.4 }
          ];
        } else if (floorId === 'Floor2') {
          shelves = [
            { id: '201_load', displayName: '201', x: 9.2, y: 12.5 },
            { id: '210_load', displayName: '210', x: 14.8, y: 15.3 },
            { id: '220_load', displayName: '220', x: 11.6, y: 10.2 }
          ];
        } else {
          shelves = [
            { id: `${floorId}_101_load`, displayName: '101', x: 10.0, y: 8.0 },
            { id: `${floorId}_102_load`, displayName: '102', x: 12.0, y: 9.0 },
            { id: `${floorId}_103_load`, displayName: '103', x: 14.0, y: 10.0 }
          ];
        }
      }
      
      logger.info(`Returning shelves: ${JSON.stringify(shelves)}`);
      res.status(200).json({ shelves });
    } catch (error) {
      logger.error(`Error retrieving shelves: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve shelves' });
    }
  });

  /**
   * Execute a workflow for a specific shelf, floor, operation, and service type
   */
  app.post('/api/simplified-workflow/execute', async (req: Request, res: Response) => {
    try {
      const { serviceType, operationType, floorId, shelfId } = req.body;
      
      if (!serviceType || !operationType || !floorId || !shelfId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Determine which workflow template to use based on operation type
      let workflowType = '';
      
      if (operationType === 'pickup') {
        if (shelfId === 'pickup_load' || shelfId === 'pick-up_load') {
          // Central pickup to a shelf operation
          workflowType = 'central-to-shelf';
        } else {
          // Shelf to central dropoff operation
          workflowType = 'pickup-to-104-workflow';
        }
      } else if (operationType === 'dropoff') {
        if (shelfId === 'dropoff_load' || shelfId === 'drop-off_load') {
          // Shelf to central dropoff operation
          workflowType = 'shelf-to-central';
        } else {
          // Central pickup to a shelf operation
          workflowType = 'zone-104-workflow';
        }
      }
      
      // To avoid circular dependencies, we'll use the dynamic import
      const dynamicWorkflow = await import('./dynamic-workflow');
      
      // Execute the workflow directly
      const workflowResult = await dynamicWorkflow.executeWorkflow(workflowType, {
        serviceType,
        operationType,
        floorId,
        shelfId
      });
      
      res.status(200).json({
        success: workflowResult.success,
        missionId: workflowResult.missionId || 'unknown',
        message: workflowResult.message || 'Workflow execution started'
      });
    } catch (error) {
      logger.error(`Error executing workflow: ${error}`);
      res.status(500).json({ error: 'Failed to execute workflow' });
    }
  });

  logger.info('✅ Registered robot capabilities API routes');
}