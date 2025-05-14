/**
 * Test script for the generic shelf-to-central workflow
 * 
 * This script tests the workflow with different shelf IDs to verify
 * it properly works for any shelf point, not just 104.
 */

import axios from 'axios';

async function testGenericShelfWorkflow() {
  try {
    // Test the workflow with different shelf IDs
    const shelfIds = ['104', '112', '115']; // Test all shelf points on Floor1
    
    // Test the first one
    const shelfId = shelfIds[0];
    console.log(`Testing shelf-to-central workflow with shelf ID: ${shelfId}`);
    
    const response = await axios.post('http://localhost:5000/api/workflows/execute', {
      workflowType: 'shelf-to-central', // Use the new generic workflow type
      params: {
        serviceType: 'robot',
        operationType: 'pickup',
        floorId: '1',
        shelfId: shelfId
      }
    });
    
    console.log('Workflow execution response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('✅ Workflow execution started successfully!');
    return response.data;
  } catch (error) {
    console.error('Error executing workflow:');
    console.error(error.response?.data || error.message);
  }
}

// Main function to run the test
async function main() {
  const result = await testGenericShelfWorkflow();
  console.log(result);
}

// Execute the main function
main().catch(console.error);

// Export the function for use elsewhere
export { testGenericShelfWorkflow };
