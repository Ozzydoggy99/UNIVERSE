/**
 * Test script for the Central to Shelf workflow
 * 
 * This script tests the dynamic workflow with the updated templates
 * to verify bins are properly dropped at shelf locations without redundant
 * reversal movements.
 */

import axios from 'axios';
import { setTimeout } from 'timers/promises';

// Configuration
const API_BASE = 'http://localhost:5000/api';
const SHELF_ID = '104'; // Use shelf 104 for testing

async function testCentralToShelfWorkflow() {
  try {
    console.log(`Starting test of central-to-shelf workflow to shelf ${SHELF_ID}...`);
    
    // Execute the workflow
    const response = await axios.post(`${API_BASE}/workflow/run`, {
      templateId: 'central-to-shelf',
      inputs: {
        dropoffShelf: SHELF_ID
      }
    });
    
    // Log the actual response data for debugging
    console.log("API Response:", JSON.stringify(response.data).substring(0, 200) + "...");
    
    // Extract workflow ID from the response
    let workflowId;
    
    if (response.data && response.data.workflowId) {
      workflowId = response.data.workflowId;
    } else if (response.data && response.data.id) {
      workflowId = response.data.id;
    } else {
      console.error('Failed to get workflow ID from response');
      return;
    }
    console.log(`Workflow started with ID: ${workflowId}`);
    
    // Monitor the workflow execution
    await monitorWorkflow(workflowId);
    
  } catch (error) {
    console.error('Error executing test:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

async function monitorWorkflow(workflowId) {
  let completed = false;
  let lastStep = '';
  let maxAttempts = 30;
  let attempts = 0;
  
  console.log('Monitoring workflow execution...');
  
  while (!completed && attempts < maxAttempts) {
    try {
      attempts++;
      const statusRes = await axios.get(`${API_BASE}/workflow/status/${workflowId}`);
      
      // Log the first status response for debugging
      if (attempts === 1) {
        console.log("Status API Response:", JSON.stringify(statusRes.data).substring(0, 200) + "...");
      }
      
      const status = statusRes.data;
      
      // Handle case where response format might be different
      const steps = status.steps || [];
      const progress = status.progress || { current: '?', total: '?' };
      
      // Only log when the current step changes
      const currentStep = steps.find(step => !step.completed);
      const currentStepDesc = currentStep ? 
        `${currentStep.type || currentStep.actionId} at ${currentStep.params?.point_id || 'unknown'}` : 
        'completed';
      
      if (currentStepDesc !== lastStep) {
        console.log(`Current step: ${currentStepDesc} (${progress.current}/${progress.total})`);
        lastStep = currentStepDesc;
      }
      
      // Check for workflow completion
      if (status.status === 'completed') {
        console.log('✅ Workflow completed successfully!');
        
        // Analyze steps to verify our changes
        analyzeWorkflowSteps(steps);
        
        completed = true;
      } else if (status.status === 'failed') {
        console.error('❌ Workflow failed:', status.error);
        completed = true;
      }
      
      if (!completed) {
        // Wait before checking again
        await setTimeout(2000);
      }
    } catch (error) {
      console.error('Error monitoring workflow:', error.message);
      await setTimeout(5000);
    }
  }
}

function analyzeWorkflowSteps(steps) {
  console.log('\n=== Workflow Step Analysis ===');
  
  // First debug the structure of the steps
  console.log(`Analyzing ${steps.length} steps`);
  if (steps.length > 0) {
    console.log(`First step example: ${JSON.stringify(steps[0]).substring(0, 100)}...`);
  }
  
  // Check for toUnloadPoint step (might be type or actionId based on API response)
  const toUnloadPoint = steps.find(step => 
    step.type === 'to_unload_point' || step.actionId === 'toUnloadPoint'
  );
  
  if (toUnloadPoint) {
    console.log(`✅ Found toUnloadPoint step: ${JSON.stringify(toUnloadPoint).substring(0, 100)}...`);
  } else {
    console.error('❌ No toUnloadPoint step found!');
  }
  
  // Check for jackDown step (might be type or actionId based on API response)
  const jackDown = steps.find(step => 
    step.type === 'jack_down' || step.actionId === 'jackDown'
  );
  
  if (jackDown) {
    console.log('✅ Found jackDown step');
    
    // Find the index of the jackDown step
    const jackDownIndex = steps.findIndex(step => 
      step.type === 'jack_down' || step.actionId === 'jackDown'
    );
    
    // Check what step comes after jackDown
    if (jackDownIndex >= 0 && jackDownIndex < steps.length - 1) {
      const nextStep = steps[jackDownIndex + 1];
      const nextStepType = nextStep.type || nextStep.actionId;
      console.log(`Step after jackDown: ${nextStepType}`);
      
      // Verify no reverse step follows jackDown
      if (nextStepType === 'reverse' || nextStepType === 'reverseFromRack') {
        console.error('❌ Found reverse step after jackDown!');
      } else if (nextStepType === 'return_to_charger' || nextStepType === 'returnToCharger') {
        console.log('✅ jackDown is correctly followed by returnToCharger');
      } else {
        console.log(`⚠️ jackDown is followed by unexpected step: ${nextStepType}`);
      }
    }
  } else {
    console.error('❌ No jackDown step found!');
  }
  
  console.log('=== End of Analysis ===\n');
}

// Run the test
testCentralToShelfWorkflow();