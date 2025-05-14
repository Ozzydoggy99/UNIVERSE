/**
 * Test script for the generic shelf-to-central workflow
 * 
 * This script tests the workflow with different shelf IDs to verify
 * it properly works for any shelf point, not just 104.
 */

import axios from 'axios';

async function testGenericShelfWorkflow(shelfId = '104', direction = 'shelf-to-central') {
  try {
    console.log(`Testing ${direction} workflow with shelf ID: ${shelfId}`);
    
    // Set operationType based on the direction
    let operationType = 'pickup';
    if (direction === 'central-to-shelf') {
      operationType = 'dropoff';
    }
    
    const response = await axios.post('http://localhost:5000/api/workflows/execute', {
      workflowType: direction, // Use the specified workflow direction
      params: {
        serviceType: 'robot',
        operationType: operationType,
        floorId: '1', // Floor1 - where all our shelf points are located
        shelfId: shelfId
      }
    });
    
    console.log('Workflow execution response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log(`✅ ${direction} workflow execution started successfully!`);
    return response.data;
  } catch (error) {
    console.error(`Error executing ${direction} workflow:`);
    console.error(error.response?.data || error.message);
    return null;
  }
}

// Test shelf IDs with specified workflow direction
async function testAllShelfPoints() {
  const shelfIds = ['104', '112', '115']; // All shelf points on Floor1
  
  console.log('------------------------------------------------------');
  console.log('TESTING GENERIC WORKFLOW WITH SHELF POINTS');
  console.log('------------------------------------------------------');
  
  // Get command line arguments
  const testShelfId = process.argv[2] || shelfIds[0]; // Default to 104
  const direction = process.argv[3] || 'shelf-to-central'; // Default direction
  
  // Validate direction
  if (direction !== 'shelf-to-central' && direction !== 'central-to-shelf') {
    console.error(`Invalid direction: ${direction}. Must be 'shelf-to-central' or 'central-to-shelf'`);
    return;
  }
  
  console.log(`Testing ${direction} workflow with shelf point: ${testShelfId}`);
  await testGenericShelfWorkflow(testShelfId, direction);
}

// Main function to run the test
async function main() {
  // Command line arguments format: node test-generic-shelf-workflow.js [shelfId] [direction]
  // Example: node test-generic-shelf-workflow.js 104 shelf-to-central
  // Example: node test-generic-shelf-workflow.js 115 central-to-shelf
  
  console.log(`
Usage:
  node test-generic-shelf-workflow.js [shelfId] [direction]
  
  [shelfId]    - Shelf ID to test with (default: 104)
  [direction]  - Workflow direction: 'shelf-to-central' or 'central-to-shelf' (default: shelf-to-central)
  
  Examples:
    node test-generic-shelf-workflow.js 104 shelf-to-central
    node test-generic-shelf-workflow.js 115 central-to-shelf
  `);
  
  await testAllShelfPoints();
}

// Execute the main function
main().catch(console.error);

// Export the functions for use elsewhere
export { testGenericShelfWorkflow, testAllShelfPoints };
