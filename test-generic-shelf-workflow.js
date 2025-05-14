/**
 * Test script for the generic shelf-to-central workflow
 * 
 * This script tests the workflow with different shelf IDs to verify
 * it properly works for any shelf point, not just 104.
 */

import axios from 'axios';

async function testGenericShelfWorkflow(shelfId = '104') {
  try {
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
    return null;
  }
}

// Test all shelf IDs on Floor1
async function testAllShelfPoints() {
  const shelfIds = ['104', '112', '115']; // All shelf points on Floor1
  
  console.log('------------------------------------------------------');
  console.log('TESTING GENERIC WORKFLOW WITH ALL SHELF POINTS');
  console.log('------------------------------------------------------');
  
  // Only test the first shelf (104) by default
  // SAFETY: Don't test all shelves at once as it would cause multiple robot missions
  // To test other shelves, specify the shelf ID as a command line argument
  const testShelfId = process.argv[2] || shelfIds[0];
  
  console.log(`Testing shelf point: ${testShelfId}`);
  await testGenericShelfWorkflow(testShelfId);
}

// Main function to run the test
async function main() {
  await testAllShelfPoints();
}

// Execute the main function
main().catch(console.error);

// Export the functions for use elsewhere
export { testGenericShelfWorkflow, testAllShelfPoints };
