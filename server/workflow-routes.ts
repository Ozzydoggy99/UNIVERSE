import { Router } from 'express';
import { 
  workflowTemplates
} from './workflow-templates';
import { createWorkflow } from './workflow-builder';
import { validatePointId } from './robot-point-utilities';

const router = Router();

// Endpoint to get available workflow templates
router.get('/api/workflows', (req, res) => {
  const templates = Object.values(workflowTemplates).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    inputs: template.inputs
  }));
  
  res.json(templates);
});

// Endpoint to execute a workflow using the workflow templates builder
router.post('/api/workflows/template', async (req, res) => {
  try {
    const { workflowId, inputs } = req.body;
    
    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }
    
    // Get the template for the requested workflow
    const template = workflowTemplates[workflowId];
    if (!template) {
      return res.status(404).json({ error: 'Workflow template not found' });
    }
    
    // Validate inputs based on our naming convention
    const inputErrors = [];
    
    for (const [key, value] of Object.entries(inputs)) {
      // Find the corresponding input definition
      const inputDef = template.inputs.find(i => i.id === key);
      
      // Skip validation for non-point inputs
      if (!inputDef || inputDef.type !== 'point') continue;
      
      // Validate point IDs
      const validation = validatePointId(value as string);
      if (!validation.valid) {
        inputErrors.push(`Invalid ${key}: ${validation.errors.join(', ')}`);
      }
    }
    
    if (inputErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Input validation failed', 
        details: inputErrors 
      });
    }
    
    // Create and execute the workflow
    console.log(`[WORKFLOW] Starting workflow: ${template.name}`);
    console.log(`[WORKFLOW] With inputs:`, inputs);
    
    const workflow = await createWorkflow(template, inputs);
    const result = await workflow();
    
    console.log(`[WORKFLOW] Workflow ${template.name} completed with success: ${result.success}`);
    
    res.json(result);
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ 
      error: 'Failed to execute workflow', 
      message: error.message 
    });
  }
});

// Endpoint to specifically handle shelf-to-shelf transfers
router.post('/api/workflow/shelf-to-shelf', async (req, res) => {
  try {
    const { pickupShelf, dropoffShelf } = req.body;
    
    if (!pickupShelf || !dropoffShelf) {
      return res.status(400).json({ 
        error: 'Both pickupShelf and dropoffShelf are required for shelf-to-shelf transfer'
      });
    }
    
    console.log(`Executing shelf-to-shelf workflow: ${pickupShelf} -> ${dropoffShelf}`);
    
    // Get the shelf-to-shelf workflow template
    const template = workflowTemplates['shelf-to-shelf'];
    if (!template) {
      return res.status(404).json({ error: 'Shelf-to-shelf workflow template not found' });
    }
    
    // Execute the workflow with the proper inputs
    const result = await createWorkflow(template, {
      pickupShelf,
      dropoffShelf
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error executing shelf-to-shelf workflow:', error);
    res.status(500).json({ 
      error: 'Failed to execute shelf-to-shelf workflow',
      message: error.message 
    });
  }
});

// Endpoint to get details of a specific workflow template
router.get('/api/workflows/:id', (req, res) => {
  const templateId = req.params.id;
  const template = workflowTemplates[templateId];
  
  if (!template) {
    return res.status(404).json({ error: 'Workflow template not found' });
  }
  
  res.json(template);
});

// Direct endpoint for the dynamic workflow system 
// This is used by the test-workflow-log.js script
router.post('/api/workflows/execute', async (req, res) => {
  try {
    const { workflowType, params } = req.body;
    
    if (!workflowType) {
      return res.status(400).json({ error: 'workflowType is required' });
    }
    
    if (!params) {
      return res.status(400).json({ error: 'params are required' });
    }
    
    console.log(`[WORKFLOW-ROUTES] Executing dynamic workflow ${workflowType}`, params);
    
    // Import dynamically to prevent circular dependencies
    const { executeWorkflow } = await import('./dynamic-workflow');
    const result = await executeWorkflow(workflowType, params);
    
    console.log(`[WORKFLOW-ROUTES] Dynamic workflow result:`, result);
    res.json(result);
  } catch (error) {
    console.error('[WORKFLOW-ROUTES] Error executing dynamic workflow:', error);
    res.status(500).json({ 
      error: 'Failed to execute workflow', 
      message: error.message 
    });
  }
});

// Debug endpoint to check actual point IDs in the map
router.get('/api/debug/map-points', async (req, res) => {
  try {
    const { fetchRobotMapPoints } = await import('./robot-map-data');
    const points = await fetchRobotMapPoints();
    res.json({ 
      totalPoints: points.length,
      points: points.map(p => ({ 
        id: p.id, 
        floorId: p.floorId,
        x: p.x,
        y: p.y
      }))
    });
  } catch (error) {
    console.error('Error fetching map points for debug:', error);
    res.status(500).json({ error: 'Failed to fetch map points' });
  }
});

export default router;
  // Test endpoint for step execution
  app.post('/api/test-step-execution', async (req, res) => {
    try {
      const { stepType, params } = req.body;
      console.log(`STEP TEST: Executing ${stepType} step with params: ${JSON.stringify(params)}`);
      
      // Use the missionQueue to execute the step
      let result;
      if (stepType === 'to_unload_point') {
        // Import the proper method
        const { missionQueue } = require('./mission-queue');
        result = await missionQueue.executeToUnloadPointStep(params);
      } else {
        throw new Error(`Step type ${stepType} not supported for testing`);
      }
      
      res.json({ success: true, result });
    } catch (error) {
      console.error('Error in test step execution:', error);
      res.status(500).json({ 
        error: 'Failed to execute test step',
        message: error.message
      });
    }
  });
