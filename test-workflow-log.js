/**
 * Test script to validate the generic workflow implementation
 * 
 * This script tests workflows with different shelf IDs to verify the system
 * is truly generic and not hardcoded for specific points.
 */

import axios from 'axios';
import fs from 'fs';

const LOG_FILE = './generic-workflow-test.log';

// Write to the log file with timestamp
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Test the generic shelf-to-central workflow
async function testGenericWorkflow(shelfId = '104') {
  try {
    logWithTimestamp(`Testing shelf-to-central workflow with shelf ID: ${shelfId}`);
    
    const response = await axios.post('http://localhost:5000/api/workflows/execute', {
      workflowType: 'shelf-to-central',
      params: {
        serviceType: 'robot',
        operationType: 'pickup',
        floorId: '1',
        shelfId: shelfId
      }
    });
    
    const workflowId = response.data.id || response.data.workflowId || 'unknown';
    logWithTimestamp(`✅ Workflow execution started successfully with ID: ${workflowId}`);
    
    // Log the full API response for debugging
    logWithTimestamp(`API Response: ${JSON.stringify(response.data, null, 2)}`);
    
    return response.data;
  } catch (error) {
    logWithTimestamp(`❌ Error executing workflow: ${error.response?.data || error.message}`);
    return null;
  }
}

// Test all available shelf points one by one
async function testAllShelfPoints() {
  // All known shelf points on Floor1 from the robot map
  const shelfIds = ['104', '112', '115']; 
  
  logWithTimestamp('------------------------------------------------------');
  logWithTimestamp('TESTING GENERIC WORKFLOW WITH MULTIPLE SHELF POINTS');
  logWithTimestamp('------------------------------------------------------');
  
  for (const shelfId of shelfIds) {
    logWithTimestamp(`\nTesting shelf point: ${shelfId}`);
    const result = await testGenericWorkflow(shelfId);
    
    // Log the workflow ID for tracking
    if (result && result.workflowId) {
      logWithTimestamp(`Workflow ID: ${result.workflowId}`);
    }
    
    // Prevent running multiple workflows simultaneously
    // Wait for 5 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Main function to run the tests
async function main() {
  // Initialize the log file
  fs.writeFileSync(LOG_FILE, `Generic Workflow Test - ${new Date().toISOString()}\n\n`);
  
  // Test with command line argument or run all tests
  if (process.argv[2]) {
    await testGenericWorkflow(process.argv[2]);
  } else {
    await testAllShelfPoints();
  }
}

// Execute the tests
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});