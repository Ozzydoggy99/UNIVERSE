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
   * Clear robot capabilities cache
   * This forces a refresh of robot capabilities data
   */
  app.post('/api/robot-capabilities/clear-cache', async (req: Request, res: Response) => {
    try {
      const robotId = ROBOT_SERIAL;
      await storage.clearRobotCapabilities(robotId);
      logger.info(`Cleared robot capabilities cache for robot ${robotId}`);
      res.status(200).json({ success: true, message: `Cleared capabilities cache for robot ${robotId}` });
    } catch (error) {
      logger.error(`Error clearing robot capabilities cache: ${error}`);
      res.status(500).json({ error: 'Failed to clear robot capabilities cache' });
    }
  });

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
      
      // Strict policy: Only show operations discovered from robot capabilities
      // No fallbacks or default operations if none are found
      // This ensures users only see operations the robot can actually perform
      let operations = [];
      
      // Don't catch exceptions - let them propagate to show real errors
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // For our unified robot service type, create operations based on robot capabilities
      // with no hardcoded service type assumptions
      
      // Check if we have central pickup, central dropoff, or shelf points
      // Only show these operations if the robot has the capabilities for them
      if (capabilities.hasCentralPickup) {
        operations.push({
          id: 'pickup',
          displayName: 'Pick Up',
          enabled: true
        });
      }
      
      if (capabilities.hasCentralDropoff) {
        operations.push({
          id: 'dropoff',
          displayName: 'Drop Off',
          enabled: true
        });
      }
      
      // If we have multiple shelves on any map, allow shelf-to-shelf transfers
      const hasMultipleShelves = capabilities.maps.some(map => map.shelfPoints.length >= 2);
      if (hasMultipleShelves) {
        operations.push({
          id: 'transfer',
          displayName: 'Transfer Between Shelves',
          enabled: true
        });
      }
      
      // Log what we found from robot
      logger.info(`Found ${operations.length} operations from robot for service type ${serviceType}`);
      
      // No fallbacks - only show operations that actually exist on the robot
      if (operations.length === 0) {
        logger.warn(`No operations found from robot API for service type: ${serviceType}`);
      }
      
      logger.info(`Returning operations: ${JSON.stringify(operations)}`);
      res.status(200).json({ operations });
    } catch (error) {
      logger.error(`Error retrieving operations for service type: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve operations' });
    }
  });
  
  /**
   * Get operations directly - without requiring service type
   * This is the new endpoint that replaces the service type selection step
   */
  app.get('/api/simplified-workflow/operations', async (req: Request, res: Response) => {
    try {
      logger.info(`Getting operations directly (no service type)`);
      
      // Strict policy: Only show operations discovered from robot capabilities
      // No fallbacks or default operations if none are found
      const operations = [];
      
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // For our unified robot service type, create operations based on robot capabilities
      if (capabilities.hasCentralPickup) {
        operations.push({
          id: 'pickup',
          displayName: 'Pick Up',
          enabled: true
        });
      }
      
      if (capabilities.hasCentralDropoff) {
        operations.push({
          id: 'dropoff',
          displayName: 'Drop Off',
          enabled: true
        });
      }
      
      // If we have multiple shelves on any map, allow shelf-to-shelf transfers
      // Added null check to handle when shelfPoints might be undefined
      const hasMultipleShelves = capabilities.maps.some(map => 
        map.shelfPoints && Array.isArray(map.shelfPoints) && map.shelfPoints.length >= 2
      );
      
      if (hasMultipleShelves) {
        operations.push({
          id: 'transfer',
          displayName: 'Transfer Between Shelves',
          enabled: true
        });
      }
      
      // Log what we found from robot
      logger.info(`Found ${operations.length} operations from robot (direct endpoint)`);
      
      // No fallbacks - only show operations that actually exist on the robot
      if (operations.length === 0) {
        logger.warn(`No operations found from robot API (direct endpoint)`);
      }
      
      logger.info(`Returning operations: ${JSON.stringify(operations)}`);
      res.status(200).json({ operations });
    } catch (error) {
      logger.error(`Error retrieving operations (direct endpoint): ${error}`);
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
      
      // No fallbacks - we only use actual floors from the robot's capabilities
      let floors: Floor[] = [];
      
      // Don't catch exceptions - let them propagate to show real errors
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
      
      // No fallback - only show floors that actually exist on the robot
      if (floors.length === 0) {
        logger.info('No floors found on robot');
      }
      
      logger.info(`Returning floors: ${JSON.stringify(floors)}`);
      res.status(200).json({ floors });
    } catch (error) {
      logger.error(`Error retrieving floors: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve floors' });
    }
  });
  
  /**
   * Get floors for a specific operation directly (without service type)
   */
  app.get('/api/simplified-workflow/operations/:operationType/floors', async (req: Request, res: Response) => {
    try {
      const { operationType } = req.params;
      logger.info(`Getting floors for operation ${operationType} (direct endpoint)`);
      
      // Define floor type to fix TypeScript issues
      interface Floor {
        id: string;
        displayName: string;
        floorNumber: number;
      }
      
      // No fallbacks - we only use actual floors from the robot's capabilities
      let floors: Floor[] = [];
      
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
      
      // No fallback - only show floors that actually exist on the robot
      if (floors.length === 0) {
        logger.info('No floors found on robot (direct endpoint)');
      }
      
      logger.info(`Returning floors: ${JSON.stringify(floors)}`);
      res.status(200).json({ floors });
    } catch (error) {
      logger.error(`Error retrieving floors (direct endpoint): ${error}`);
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
      
      // No fallbacks - we only use actual shelves from the robot
      let shelves: Shelf[] = [];
      
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // Debug log the maps
      logger.info(`Available maps: ${JSON.stringify(capabilities.maps.map(m => ({ id: m.id, displayName: m.displayName })))}`);
      
      // Convert floorId to string for comparison since map IDs could be numbers
      const floorMapId = String(floorId);
      
      // Find the specified map - match by either ID or display name
      const map = capabilities.maps.find(m => 
        String(m.id) === floorMapId || 
        String(m.displayName) === floorMapId
      );
      
      if (map) {
        logger.info(`Found map for floor ${floorId}: ${JSON.stringify(map)}`);
        
        // Check if we have shelf points
        if (map.shelfPoints && map.shelfPoints.length > 0) {
          // Get shelf points for the map
          shelves = map.shelfPoints.map(point => ({
            id: point.id,
            displayName: point.displayName,
            x: point.x,
            y: point.y
          }));
        } else {
          // If no specific shelf points exist, try to retrieve points from the full points array
          logger.info(`No shelf points found, extracting from full points array for floor ${floorId}`);
          
          if (map.points && Array.isArray(map.points)) {
            const filteredPoints = map.points.filter((point: any) => {
              const name = (point.name || '').toLowerCase();
              if (operationType === 'pickup') {
                return name.includes('pickup') || name.includes('shelf') || name.includes('load');
              } else if (operationType === 'dropoff') {
                return name.includes('dropoff') || name.includes('shelf') || name.includes('dock');
              }
              return true; // Include all points for other operation types
            });
            
            // Map the filtered points to the expected shelf format
            shelves = filteredPoints.map((point: any) => {
              // Extract position information from different possible structures
              let x = 0, y = 0;
              if (point.pose?.position) {
                x = point.pose.position.x || 0;
                y = point.pose.position.y || 0;
              } else if (point.x !== undefined && point.y !== undefined) {
                x = point.x;
                y = point.y;
              } else if (point.coord && point.coord.length >= 2) {
                x = point.coord[0] || 0;
                y = point.coord[1] || 0;
              } else if (point.position) {
                x = point.position.x || 0;
                y = point.position.y || 0;
              }
              
              // Format display name
              const name = point.name || point.id || `Point ${point.id}`;
              const displayName = name.replace(/_/g, ' ').replace(/(\d+)_(\w+)/, '$1 $2');
              
              return {
                id: String(point.id || point.name),
                displayName,
                x,
                y
              };
            });
          }
        }
      } else {
        logger.warn(`Floor ${floorId} not found in robot capabilities`);
        throw new Error(`Floor ${floorId} not found in robot capabilities`);
      }
      
      // No fallback - only show shelves that actually exist on the robot
      if (shelves.length === 0) {
        logger.info(`No shelves found for floor ${floorId}`);
      }
      
      logger.info(`Returning shelves: ${JSON.stringify(shelves)}`);
      res.status(200).json({ shelves });
    } catch (error) {
      logger.error(`Error retrieving shelves: ${error}`);
      res.status(500).json({ error: 'Failed to retrieve shelves' });
    }
  });
  
  /**
   * Get shelf points for a specific floor and operation directly (without service type)
   */
  app.get('/api/simplified-workflow/operations/:operationType/floors/:floorId/shelves', async (req: Request, res: Response) => {
    try {
      const { operationType, floorId } = req.params;
      logger.info(`Getting shelves for operation ${operationType}, floor ${floorId} (direct endpoint)`);
      
      // Define shelf type to fix TypeScript issues
      interface Shelf {
        id: string;
        displayName: string;
        x: number;
        y: number;
      }
      
      // No fallbacks - we only use actual shelves from the robot
      let shelves: Shelf[] = [];
      
      const robotId = ROBOT_SERIAL;
      const capabilities = await discoverRobotCapabilities(robotId);
      
      // Debug log the maps
      logger.info(`Available maps: ${JSON.stringify(capabilities.maps.map(m => ({ id: m.id, displayName: m.displayName })))}`);
      
      // Convert floorId to string for comparison since map IDs could be numbers
      const floorMapId = String(floorId);
      
      // Find the specified map - match by either ID or display name
      const map = capabilities.maps.find(m => 
        String(m.id) === floorMapId || 
        String(m.displayName) === floorMapId
      );
      
      if (map) {
        logger.info(`Found map for floor ${floorId}: ${JSON.stringify(map)}`);
        
        // Check if we have shelf points
        if (map.shelfPoints && map.shelfPoints.length > 0) {
          // Get shelf points for the map
          shelves = map.shelfPoints.map(point => ({
            id: point.id,
            displayName: point.displayName,
            x: point.x,
            y: point.y
          }));
        } else {
          // If no specific shelf points exist, try to retrieve points from the full points array
          logger.info(`No shelf points found, extracting from full points array for floor ${floorId}`);
          
          if (map.points && Array.isArray(map.points)) {
            const filteredPoints = map.points.filter((point: any) => {
              const name = (point.name || '').toLowerCase();
              if (operationType === 'pickup') {
                return name.includes('pickup') || name.includes('shelf') || name.includes('load');
              } else if (operationType === 'dropoff') {
                return name.includes('dropoff') || name.includes('shelf') || name.includes('dock');
              }
              return true; // Include all points for other operation types
            });
            
            // Map the filtered points to the expected shelf format
            shelves = filteredPoints.map((point: any) => {
              // Extract position information from different possible structures
              let x = 0, y = 0;
              if (point.pose?.position) {
                x = point.pose.position.x || 0;
                y = point.pose.position.y || 0;
              } else if (point.x !== undefined && point.y !== undefined) {
                x = point.x;
                y = point.y;
              } else if (point.coord && point.coord.length >= 2) {
                x = point.coord[0] || 0;
                y = point.coord[1] || 0;
              } else if (point.position) {
                x = point.position.x || 0;
                y = point.position.y || 0;
              }
              
              // Format display name
              const name = point.name || point.id || `Point ${point.id}`;
              const displayName = name.replace(/_/g, ' ').replace(/(\d+)_(\w+)/, '$1 $2');
              
              return {
                id: String(point.id || point.name),
                displayName,
                x,
                y
              };
            });
          }
        }
      } else {
        logger.warn(`Floor ${floorId} not found in robot capabilities (direct endpoint)`);
        throw new Error(`Floor ${floorId} not found in robot capabilities`);
      }
      
      // No fallback - only show shelves that actually exist on the robot
      if (shelves.length === 0) {
        logger.info(`No shelves found for floor ${floorId} (direct endpoint)`);
      }
      
      logger.info(`Returning shelves: ${JSON.stringify(shelves)}`);
      res.status(200).json({ shelves });
    } catch (error) {
      logger.error(`Error retrieving shelves (direct endpoint): ${error}`);
      res.status(500).json({ error: 'Failed to retrieve shelves' });
    }
  });

  /**
   * Execute a workflow for a specific shelf, floor, operation, and service type
   */
  app.post('/api/simplified-workflow/execute', async (req: Request, res: Response) => {
    try {
      const { operationType, floorId, shelfId } = req.body;
      // Service type is no longer required
      const serviceType = 'robot'; // Default service type
      
      if (!operationType || !floorId || !shelfId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Determine which workflow template to use based on operation type
      // Making this generic for any shelf ID
      let workflowType = '';
      
      if (operationType === 'pickup') {
        if (shelfId === 'pickup_load' || shelfId === 'pick-up_load') {
          // Central pickup to a shelf operation
          workflowType = 'central-to-shelf';
        } else {
          // This is the universal "shelf-to-central" workflow that works with ANY shelf ID
          // It no longer has a hardcoded dependency on '104'
          workflowType = 'shelf-to-central';
        }
      } else if (operationType === 'dropoff') {
        if (shelfId === 'dropoff_load' || shelfId === 'drop-off_load') {
          // Shelf to central dropoff operation - this shouldn't happen since dropoff_load is a destination
          workflowType = 'shelf-to-central';
        } else {
          // This is the universal "central-to-shelf" workflow that works with ANY shelf ID
          // We're now using the generic template instead of the hardcoded 104 workflow
          workflowType = 'central-to-shelf';
        }
      } else if (operationType === 'transfer') {
        // Shelf to shelf transfer operation - already generic
        workflowType = 'shelf-to-shelf';
        
        // We need a source shelf and a target shelf
        if (!req.body.sourceShelfId) {
          return res.status(400).json({ error: 'Missing sourceShelfId parameter for transfer operation' });
        }
      }
      
      // To avoid circular dependencies, we'll use the dynamic import
      const dynamicWorkflow = await import('./dynamic-workflow');
      
      // Prepare parameters based on operation type
      const workflowParams: any = {
        serviceType,
        operationType,
        floorId,
        shelfId
      };
      
      // For transfer operations, add source shelf and floor information
      if (operationType === 'transfer') {
        // Check for both possible parameter names: sourceShelf (from older code) or sourceShelfId (from new UI)
        const sourceShelfId = req.body.sourceShelfId || req.body.sourceShelf;
        
        if (!sourceShelfId) {
          logger.error('Missing sourceShelfId parameter for transfer operation');
          return res.status(400).json({ error: 'Missing sourceShelfId parameter for transfer operation' });
        }
        
        workflowParams.pickupShelf = sourceShelfId;
        workflowParams.dropoffShelf = shelfId;
        logger.info(`Transfer operation from ${sourceShelfId} to ${shelfId}`);
      }
      
      logger.info(`Executing workflow type: ${workflowType} with params: ${JSON.stringify(workflowParams)}`);
      
      // Execute the workflow directly using our universal workflow module 
      try {
        logger.info(`Executing generic workflow of type: ${workflowType}`);
        logger.info(`Parameters: ${JSON.stringify(workflowParams)}`);
        
        // Call the dynamic workflow module to execute the workflow with the given parameters
        // This will work with ANY shelf ID, not just hardcoded values
        const workflowResult = await dynamicWorkflow.executeWorkflow(workflowType, workflowParams);
        
        // Log successful execution
        logger.info(`Workflow execution initiated successfully: ${JSON.stringify({ 
          success: workflowResult.success,
          missionId: workflowResult.missionId || 'unknown',
          message: workflowResult.message || 'Workflow execution started'
        })}`);
        
        // Return success response - focusing on core functionality only
        res.status(200).json({
          success: workflowResult.success,
          missionId: workflowResult.missionId || 'unknown',
          message: workflowResult.message || 'Workflow execution started',
          // Include shelf ID for frontend reference
          shelfId: shelfId
        });
      } catch (workflowError: any) {
        // Log detailed error for debugging
        logger.error(`Error in workflow execution: ${workflowError.message || workflowError}`);
        if (workflowError.stack) {
          logger.error(`Stack trace: ${workflowError.stack}`);
        }
        throw workflowError; // Let the outer catch handle it for consistent error responses
      }
    } catch (error: any) {
      // Comprehensive error logging for easier debugging
      logger.error(`Error executing workflow: ${error.message || String(error)}`);
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      
      // Return a structured error response with useful details
      res.status(500).json({ 
        success: false,
        error: 'Failed to execute workflow', 
        details: error.message || String(error),
        // Include the workflow parameters in the error response to help with debugging
        params: {
          workflowType: req.body.workflowType,
          shelfId: req.body.params?.shelfId,
          floorId: req.body.params?.floorId,
          operationType: req.body.params?.operationType
        }
      });
    }
  });

  logger.info('✅ Registered robot capabilities API routes');
}