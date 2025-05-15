/**
 * Action Test Routes
 * 
 * This module provides API endpoints for testing individual actions
 * without having to execute full workflows.
 */

import { Router } from 'express';
import { actions } from './action-modules';

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
    const action = actions[actionId];
    if (!action) {
      return res.status(404).json({ 
        error: `Action "${actionId}" not found`,
        availableActions: Object.keys(actions)
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
    
  } catch (error) {
    console.error('[ACTION-TEST] Error executing action:', error);
    return res.status(500).json({
      error: 'Failed to execute action',
      message: error.message
    });
  }
});

/**
 * Get information about available actions
 */
router.get('/api/actions', (req, res) => {
  const actionInfo = Object.entries(actions).map(([id, action]) => ({
    id,
    description: action.description,
    params: action.params,
    requiresPoints: action.requiresPoints
  }));
  
  res.json(actionInfo);
});

export default router;