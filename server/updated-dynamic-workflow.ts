// Add this code in the dynamicCentralToShelfWorkflow executeWorkflow function
// Right after the alignWithRack case, around line 2097

else if (step.actionId === 'toUnloadPoint') {
  // Get real coordinates for the point
  const pointId = stepParams.pointId;
  logWorkflow(workflowId, `Getting unload point coordinates for: ${pointId}`);
  
  // Get proper coordinates for this shelf point
  const point = await getShelfPoint(pointId);
  
  if (!point) {
    const errorMsg = `Could not find unload point coordinates for ${pointId}`;
    logWorkflow(workflowId, `❌ ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  logWorkflow(workflowId, `Found unload point coordinates for ${pointId}: (${point.x}, ${point.y}, ${point.theta})`);
  
  workflowSteps.push({
    type: 'to_unload_point',
    params: {
      x: point.x,
      y: point.y,
      ori: point.theta,
      point_id: pointId,
      label: step.description || `Moving to unload point ${pointId}`
    },
    completed: false,
    retryCount: 0
  });
}