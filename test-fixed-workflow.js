/**
 * Test script to verify the fixed unload point functionality
 * 
 * This script tests the workflow with both regular shelf points and drop-off points,
 * focusing on how they process both types of points correctly.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

/**
 * Function to initiate the dynamic workflow
 */
async function startDynamicWorkflow(type, params = {}) {
  try {
    console.log(`Starting ${type} workflow with params:`, params);
    
    const response = await axios.post(`${API_BASE_URL}/api/dynamic-workflow/${type}`, params);
    
    // Get the workflowId from the response (not id)
    const workflowId = response.data.workflowId;
    console.log(`Workflow started with ID: ${workflowId}`);
    return workflowId;
  } catch (error) {
    console.error('Failed to start workflow:', 
      error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Monitor workflow execution
 */
async function monitorWorkflow(workflowId) {
  try {
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes polling at 1 second intervals
    
    console.log(`\nMonitoring workflow execution: ${workflowId}`);
    
    while (!isComplete && attempts < maxAttempts) {
      attempts++;
      
      const response = await axios.get(`${API_BASE_URL}/api/dynamic-workflow/${workflowId}`);
      const workflow = response.data;
      
      console.log(`Status: ${workflow.status}, Step ${workflow.currentStep}/${workflow.totalSteps}`);
      console.log(`  Last message: ${workflow.lastMessage || 'No message'}`);
      
      if (workflow.status === 'completed' || workflow.status === 'failed') {
        isComplete = true;
        
        if (workflow.status === 'completed') {
          console.log(`\n✅ Workflow completed successfully!`);
        } else {
          console.log(`\n❌ Workflow failed: ${workflow.error || 'Unknown error'}`);
        }
      } else {
        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!isComplete) {
      console.log(`\n⚠️ Monitoring timed out after ${maxAttempts} seconds`);
    }
    
    return isComplete;
  } catch (error) {
    console.error('Error monitoring workflow:', 
      error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Main function to test the fixed workflow
 */
async function testFixedWorkflow() {
  try {
    // Test the shelf-to-central workflow (uses shelf point for pickup and drop-off point for dropoff)
    console.log('\n===== TESTING SHELF-TO-CENTRAL WORKFLOW =====');
    console.log('This tests a workflow that picks up from shelf 104 and delivers to drop-off_load');
    
    const shelfToCentralId = await startDynamicWorkflow('shelf-to-central', {
      pickupShelf: '104'
    });
    
    await monitorWorkflow(shelfToCentralId);
    
    // Allow some time between tests
    console.log('\nWaiting 10 seconds before starting next test...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test the central-to-shelf workflow (uses pickup point for pickup and shelf point for dropoff)
    console.log('\n===== TESTING CENTRAL-TO-SHELF WORKFLOW =====');
    console.log('This tests a workflow that picks up from pick-up_load and delivers to 104_load');
    
    const centralToShelfId = await startDynamicWorkflow('central-to-shelf', {
      dropoffShelf: '104'
    });
    
    await monitorWorkflow(centralToShelfId);
    
    console.log('\n✅ All workflow tests completed');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
testFixedWorkflow().catch(console.error);