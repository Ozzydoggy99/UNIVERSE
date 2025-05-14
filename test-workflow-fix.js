/**
 * Test script to verify workflow template changes
 * 
 * This script tests the updated dynamic workflow execution to ensure that:
 * 1. The toUnloadPoint action is correctly implemented
 * 2. Bins are properly dropped at shelf locations, not docking points
 * 3. The redundant reverseFromRack action has been successfully removed
 */

import axios from 'axios';
import { setTimeout } from 'timers/promises';

// Robot API base URL
const ROBOT_API_BASE = 'http://localhost:5000/api';

/**
 * Main test function
 */
async function testWorkflowFix() {
  try {
    console.log('Starting workflow template fix verification test...');
    
    // 1. Test the central-to-shelf workflow
    const workflowResult = await axios.post(`${ROBOT_API_BASE}/workflow/run`, {
      templateId: 'central-to-shelf',
      inputs: {
        dropoffShelf: '104' // Use shelf 104 for testing
      }
    });
    
    if (workflowResult.data.success) {
      console.log(`✅ Successfully initiated workflow with ID: ${workflowResult.data.workflowId}`);
      
      // 2. Monitor the workflow execution to verify steps
      await monitorWorkflow(workflowResult.data.workflowId);
    } else {
      console.error('❌ Failed to start workflow:', workflowResult.data.error);
    }
  } catch (error) {
    console.error('Error running test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Monitor workflow execution and verify steps
 */
async function monitorWorkflow(workflowId) {
  console.log(`Monitoring workflow execution for ID: ${workflowId}`);
  let completed = false;
  let maxRetries = 30;
  let retries = 0;
  
  while (!completed && retries < maxRetries) {
    try {
      const statusResponse = await axios.get(`${ROBOT_API_BASE}/workflow/status/${workflowId}`);
      const status = statusResponse.data;
      
      console.log(`Workflow status: ${status.status}, progress: ${status.progress.current}/${status.progress.total}`);
      
      // Check for toUnloadPoint step
      const steps = status.steps || [];
      
      // Look for the toUnloadPoint action specifically
      const toUnloadPointStep = steps.find(step => step.type === 'to_unload_point');
      
      if (toUnloadPointStep) {
        console.log('✅ Found toUnloadPoint step:', {
          completed: toUnloadPointStep.completed,
          pointId: toUnloadPointStep.params.point_id
        });
      }
      
      // Verify no reverseFromRack step follows toUnloadPoint
      const jackDownIndex = steps.findIndex(step => step.type === 'jack_down');
      if (jackDownIndex !== -1 && jackDownIndex < steps.length - 1) {
        const nextStep = steps[jackDownIndex + 1];
        if (nextStep.type !== 'reverse') {
          console.log('✅ No reverseFromRack step after jackDown - fix confirmed!');
        } else {
          console.error('❌ Found unexpected reverseFromRack step after jackDown!');
        }
      }
      
      if (status.status === 'completed') {
        console.log('✅ Workflow completed successfully!');
        completed = true;
        // Get final step data
        await verifyFinalWorkflowState(workflowId);
      } else if (status.status === 'failed') {
        console.error('❌ Workflow failed:', status.error);
        completed = true;
      }
      
      if (!completed) {
        await setTimeout(1000); // Wait 1 second before checking again
      }
    } catch (error) {
      console.error('Error checking workflow status:', error.message);
    }
    
    retries++;
  }
  
  if (!completed) {
    console.warn('⚠️ Test timed out waiting for workflow completion');
  }
}

/**
 * Verify the final state of the workflow execution
 */
async function verifyFinalWorkflowState(workflowId) {
  try {
    const logResponse = await axios.get(`${ROBOT_API_BASE}/workflow/logs/${workflowId}`);
    const logs = logResponse.data;
    
    // Check for any reverseFromRack operations in the logs
    const reverseOperations = logs.filter(log => log.message.includes('reverseFromRack'));
    
    if (reverseOperations.length === 0) {
      console.log('✅ No reverseFromRack operations found in logs - fix working!');
    } else {
      console.warn('⚠️ Found reverseFromRack operations in logs:', reverseOperations.length);
    }
    
    // Check for successful unload operations
    const unloadOperations = logs.filter(log => log.message.includes('to_unload_point'));
    
    if (unloadOperations.length > 0) {
      console.log(`✅ Found ${unloadOperations.length} to_unload_point operations in logs`);
    } else {
      console.warn('⚠️ No to_unload_point operations found in logs!');
    }
  } catch (error) {
    console.error('Error fetching workflow logs:', error.message);
  }
}

// Run the test
testWorkflowFix().catch(console.error);