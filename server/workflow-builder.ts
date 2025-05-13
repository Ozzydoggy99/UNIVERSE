import { WorkflowTemplate, SequenceStep } from './workflow-templates';
import { ActionModule, actionModules } from './action-modules';
import { 
  getFloorFromShelfPoint, 
  isShelfPoint, 
  isPickupPoint, 
  isDropoffPoint,
  getDockingPointId
} from './robot-point-utilities';

/**
 * Builds a concrete workflow sequence from a template and input parameters
 * @param template Workflow template to use as a base
 * @param inputs User inputs for the workflow
 * @returns Array of concrete workflow steps ready for execution
 */
export async function buildWorkflowSequence(
  template: WorkflowTemplate,
  inputs: Record<string, any>
): Promise<Array<{action: ActionModule, params: Record<string, any>, description: string}>> {
  // Validate all required inputs are provided
  const missingInputs = template.inputs
    .filter(input => input.required && inputs[input.id] === undefined);
  
  if (missingInputs.length > 0) {
    throw new Error(`Missing required inputs: ${missingInputs.map(i => i.name).join(', ')}`);
  }
  
  // Process template sequence to create concrete sequence
  const sequence = await Promise.all(template.sequence.map(async step => {
    // Copy the parameters to avoid modifying the original
    const resolvedParams: Record<string, any> = { ...step.params };
    
    // Process each parameter to handle our naming conventions
    for (const [key, value] of Object.entries(resolvedParams)) {
      // If it's a string that contains templates like {pickupPoint}
      if (typeof value === 'string' && value.includes('{')) {
        // Extract the parameter name
        const paramMatch = value.match(/{([^}]+)}/);
        if (paramMatch) {
          const paramName = paramMatch[1];
          
          // Get the value from inputs
          const inputValue = inputs[paramName];
          if (inputValue === undefined) {
            throw new Error(`Missing required parameter: ${paramName}`);
          }
          
          // Handle special cases based on our naming convention
          if (key === 'pointId') {
            // If this is a docking modifier
            if (value.includes('_docking') && !inputValue.includes('_docking')) {
              resolvedParams[key] = getDockingPointId(inputValue);
            } else {
              resolvedParams[key] = value.replace(`{${paramName}}`, inputValue);
            }
          } else {
            // For non-point parameters, simple replacement
            resolvedParams[key] = value.replace(`{${paramName}}`, inputValue);
          }
        }
      }
    }
    
    return {
      action: actionModules[step.actionId],
      params: resolvedParams,
      description: step.description || step.actionId
    };
  }));
  
  return sequence;
}

/**
 * Creates a ready-to-execute workflow function
 * @param template Workflow template
 * @param inputs User inputs
 * @returns Executable workflow function
 */
export async function createWorkflow(
  template: WorkflowTemplate,
  inputs: Record<string, any>
): Promise<() => Promise<WorkflowResult>> {
  const sequence = await buildWorkflowSequence(template, inputs);
  
  return async function executeWorkflow(): Promise<WorkflowResult> {
    const results = [];
    let success = true;
    
    for (const step of sequence) {
      console.log(`[WORKFLOW] Executing step: ${step.description}`);
      
      try {
        // Validate the step's parameters
        const validation = await step.action.validate(step.params);
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
        }
        
        // Execute the action
        const result = await step.action.execute(step.params);
        results.push({
          step: step.description,
          success: result.success,
          result: result.data,
          error: result.error
        });
        
        // If any step fails, mark the workflow as failed
        if (!result.success) {
          success = false;
          console.error(`[WORKFLOW] Step failed: ${step.description}`, result.error);
          break;
        }
      } catch (error) {
        console.error(`[WORKFLOW] Error executing step: ${step.description}`, error);
        results.push({
          step: step.description,
          success: false,
          error: error.message || 'Unknown error'
        });
        success = false;
        break;
      }
    }
    
    return {
      success,
      steps: results
    };
  };
}

export type WorkflowResult = {
  success: boolean;
  steps: Array<{
    step: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
};