import { Request, Response } from 'express';
import { getPointSetData } from './robot-point-mapping';

interface WorkflowRequest {
  serviceType: string;
  operationType: string;
  floorId: string;
  shelfId: string;
  pointSets: string[];
}

export async function executeWorkflow(req: Request, res: Response) {
  try {
    const { serviceType, operationType, floorId, shelfId, pointSets } = req.body as WorkflowRequest;

    // Validate required fields
    if (!serviceType || !operationType || !floorId || !shelfId || !pointSets || !Array.isArray(pointSets)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields or invalid point sets'
      });
    }

    // Only allow _load points for dropoff/unload actions
    const loadPoints = pointSets.filter((p: string) => p.endsWith('_load'));
    if (loadPoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid _load point found in point sets'
      });
    }
    // Verify that all load points exist
    for (const pointSetName of loadPoints) {
      const pointSet = await getPointSetData(pointSetName);
      if (!pointSet) {
        return res.status(400).json({
          success: false,
          error: `Point set ${pointSetName} not found`
        });
      }
    }
    // Create workflow with all load points
    const workflow = {
      id: generateWorkflowId(),
      serviceType,
      operationType,
      floorId,
      shelfId: loadPoints[0],
      pointSets: loadPoints,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Store workflow in database or cache
    // TODO: Implement workflow storage

    // Start workflow execution
    // TODO: Implement workflow execution logic using the point sets

    return res.json({
      success: true,
      data: {
        workflowId: workflow.id
      }
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute workflow'
    });
  }
}

function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
} 