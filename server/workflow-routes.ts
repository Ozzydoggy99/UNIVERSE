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

// Endpoint to execute a workflow
router.post('/api/workflows/execute', async (req, res) => {
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

// Endpoint to get details of a specific workflow template
router.get('/api/workflows/:id', (req, res) => {
  const templateId = req.params.id;
  const template = workflowTemplates[templateId];
  
  if (!template) {
    return res.status(404).json({ error: 'Workflow template not found' });
  }
  
  res.json(template);
});

export default router;