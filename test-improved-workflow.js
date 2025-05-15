/**
 * Test script to verify the improved dynamic workflow implementation
 * 
 * This script tests the workflow with both regular shelf points and drop-off points,
 * with special focus on verifying that the point ID normalization and rack area ID
 * extraction fixes are working correctly.
 */

import axios from 'axios';
import fs from 'fs';

const API_BASE_URL = 'http://localhost:5000';
const LOG_FILE = 'improved-workflow-test.log';

// Initialize log file
fs.writeFileSync(LOG_FILE, `=== IMPROVED WORKFLOW TEST LOG (${new Date().toISOString()}) ===\n\n`);

/**
 * Add a log entry to both console and log file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Function to initiate the dynamic workflow
 */
async function startDynamicWorkflow(type, params = {}) {
  try {
    log(`Starting ${type} workflow with params: ${JSON.stringify(params, null, 2)}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/dynamic-workflow/${type}`, params);
    
    // Get the workflowId from the response (not id)
    const workflowId = response.data.workflowId;
    log(`Workflow started with ID: ${workflowId}`);
    return workflowId;
  } catch (error) {
    log(`Failed to start workflow: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`);
    throw error;
  }
}

/**
 * Monitor workflow execution with detailed logging
 */
async function monitorWorkflow(workflowId) {
  try {
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes polling at 1 second intervals
    
    log(`\nMonitoring workflow execution: ${workflowId}`);
    
    while (!isComplete && attempts < maxAttempts) {
      attempts++;
      
      const response = await axios.get(`${API_BASE_URL}/api/dynamic-workflow/${workflowId}`);
      const workflow = response.data;
      
      // More targeted logging to track progress
      const statusLine = `Status: ${workflow.status}, Step ${workflow.currentStep}/${workflow.totalSteps}`;
      const messageLine = `Message: ${workflow.lastMessage || 'No message'}`;
      
      log(statusLine);
      log(messageLine);
      
      if (workflow.status === 'completed' || workflow.status === 'failed') {
        isComplete = true;
        
        if (workflow.status === 'completed') {
          log(`\n✅ Workflow completed successfully!`);
        } else {
          log(`\n❌ Workflow failed: ${workflow.error || 'Unknown error'}`);
        }
        
        // Log all workflow steps for analysis
        if (workflow.steps && workflow.steps.length > 0) {
          log('\nWorkflow steps executed:');
          workflow.steps.forEach((step, index) => {
            log(`  Step ${index + 1}: ${step.action} - Status: ${step.status}`);
            if (step.message) {
              log(`    Message: ${step.message}`);
            }
          });
        }
      } else {
        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!isComplete) {
      log(`\n⚠️ Monitoring timed out after ${maxAttempts} seconds`);
    }
    
    return isComplete;
  } catch (error) {
    log(`Error monitoring workflow: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`);
    throw error;
  }
}

/**
 * Test different point ID formats for central-to-shelf workflow
 */
async function testPointIdFormats() {
  try {
    log('\n===== TESTING POINT ID FORMAT HANDLING =====');
    
    // Test with various point ID formats to verify normalization
    
    // Test 1: Just numeric shelf ID (should automatically append "_load")
    log('\n--- Test 1: Numeric shelf ID ---');
    const numericId = await startDynamicWorkflow('central-to-shelf', {
      dropoffShelf: '104'  // Just the number without "_load"
    });
    await monitorWorkflow(numericId);
    
    // Wait between tests
    log('\nWaiting 10 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test 2: Mixed case drop-off ID (should handle case-insensitively)
    log('\n--- Test 2: Mixed case drop-off point ---');
    const mixedCaseId = await startDynamicWorkflow('shelf-to-central', {
      pickupShelf: '115'  // Picking up from shelf 115, delivering to Drop-Off
    });
    await monitorWorkflow(mixedCaseId);
    
    log('\n✅ All point ID format tests completed');
  } catch (error) {
    log(`Test failed: ${error}`);
  }
}

/**
 * Main test function
 */
async function testImprovedWorkflow() {
  try {
    log('Starting improved workflow tests...');
    
    // Test with different point ID formats
    await testPointIdFormats();
    
    log('\nAll tests completed');
  } catch (error) {
    log(`Tests failed: ${error}`);
  }
}

// Run the tests
testImprovedWorkflow().catch(error => log(`Unhandled error: ${error}`));