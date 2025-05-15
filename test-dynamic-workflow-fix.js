/**
 * Test script to verify the fixed dynamic workflow implementation
 * 
 * This script runs a test of the shelf-to-central workflow using the dynamic workflow system
 * with the recently fixed toUnloadPoint action.
 */
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

async function testDynamicWorkflow() {
  try {
    console.log('=== TESTING FIXED DYNAMIC WORKFLOW IMPLEMENTATION ===');
    
    // Create a test workflow execution - shelf-to-central workflow
    // This workflow will:
    // 1. Move to a shelf docking point 
    // 2. Align with rack and jack up
    // 3. Move to drop-off docking point
    // 4. Use toUnloadPoint for the drop-off load point (critical test)
    // 5. Jack down to release bin
    // 6. Return to charger
    
    console.log('Starting shelf-to-central workflow with test shelf point...');
    
    const response = await axios.post(`${API_BASE_URL}/api/dynamic-workflow/shelf-to-central`, {
      serviceType: 'robot',
      operationType: 'pickup',
      floorId: '3',
      shelfId: '104',  // Use shelf 104 as our test point
      pickupShelf: '104' // This is the point we'll be picking up from
    });
    
    console.log('Workflow initiated with response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.workflowId) {
      const workflowId = response.data.workflowId;
      console.log(`Workflow started with ID: ${workflowId}`);
      
      // Monitor workflow status
      await monitorWorkflow(workflowId);
    } else {
      console.log('Error: No workflow ID returned');
    }
    
    console.log('\nTest completed');
    
  } catch (error) {
    console.error('Error testing dynamic workflow:', 
      error.response ? error.response.data : error.message);
  }
}

async function monitorWorkflow(workflowId) {
  console.log(`\nMonitoring workflow ${workflowId}...`);
  
  // Poll the workflow status endpoint
  let completed = false;
  let attempt = 0;
  const maxAttempts = 10; // Just check a few times - we're not waiting for full execution
  
  while (!completed && attempt < maxAttempts) {
    attempt++;
    
    try {
      console.log(`\nChecking workflow status (attempt ${attempt})...`);
      const statusResponse = await axios.get(
        `${API_BASE_URL}/api/dynamic-workflow/status/${workflowId}`
      );
      
      // Log the workflow status
      console.log('Workflow status:', JSON.stringify(statusResponse.data, null, 2));
      
      if (statusResponse.data.status === 'completed') {
        console.log('✅ Workflow completed successfully!');
        completed = true;
      } else if (statusResponse.data.status === 'failed') {
        console.log('❌ Workflow failed:', statusResponse.data.error);
        completed = true;
      } else {
        console.log(`Workflow in progress: Step ${statusResponse.data.currentStep}/${statusResponse.data.totalSteps}`);
        console.log(`Last message: ${statusResponse.data.lastMessage}`);
        
        // Wait 3 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error('Error checking workflow status:', 
        error.response ? error.response.data : error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  if (!completed) {
    console.log('⚠️ Test monitoring timeout - workflow still in progress');
  }
}

// Run the test
testDynamicWorkflow().catch(err => {
  console.error('Test script error:', err);
});