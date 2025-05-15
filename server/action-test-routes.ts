/**
 * Action Test Routes
 * 
 * This module provides API endpoints for testing individual actions
 * without having to execute full workflows.
 */

import { Router } from 'express';
import { actionModules, ActionModule } from './action-modules';
import { Action } from './to-unload-point-action';

const router = Router();

/**
 * Execute a single action step
 * This is useful for testing individual actions in isolation
 */
router.post('/api/execute-step', async (req, res) => {
  try {
    const { actionId, params } = req.body;
    
    if (!actionId) {
      return res.status(400).json({ error: 'actionId is required' });
    }
    
    // Validate that the action exists
    const action: ActionModule | Action = actionModules[actionId as keyof typeof actionModules];
    if (!action) {
      return res.status(404).json({ 
        error: `Action "${actionId}" not found`,
        availableActions: Object.keys(actionModules)
      });
    }
    
    console.log(`[ACTION-TEST] Executing action "${actionId}" with params:`, params);
    
    // Validate action parameters
    const validation = await action.validate(params);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: validation.errors
      });
    }
    
    // Execute the action
    const result = await action.execute(params);
    
    // Return the result
    return res.json(result);
    
  } catch (error: unknown) {
    console.error('[ACTION-TEST] Error executing action:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: 'Failed to execute action',
      message: errorMessage
    });
  }
});

/**
 * Get information about available actions
 */
router.get('/api/actions', (req, res) => {
  const actionInfo = Object.entries(actionModules).map(([id, action]: [string, ActionModule | Action]) => ({
    id,
    description: action.description,
    requiresPoints: action.requiresPoints
  }));
  
  res.json(actionInfo);
});

export default router;