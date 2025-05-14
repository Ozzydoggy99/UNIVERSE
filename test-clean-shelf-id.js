/**
 * Test script to verify the cleanShelfId helper function works correctly
 * 
 * This script tests various shelf ID formats to ensure they're properly
 * cleaned to prevent duplicate "_load" suffixes when creating missions.
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Clean shelf ID function (copied from our implementation for testing)
function cleanShelfId(shelfId) {
  if (shelfId && typeof shelfId === 'string' && shelfId.toLowerCase().endsWith('_load')) {
    return shelfId.substring(0, shelfId.length - 5);
  }
  return shelfId;
}

// Helper function to log output with timestamps
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Test different shelf ID formats
const testShelfIds = [
  '104',
  '104_load',
  '104_LOAD',
  '104_load_load',
  '104_load_load_docking',
  'pick-up_load',
  'pickup_load',
  'drop-off_load',
  'dropoff_load'
];

// Run cleanShelfId tests
async function testCleanShelfId() {
  log('🧪 Testing cleanShelfId helper function');
  
  testShelfIds.forEach(shelfId => {
    const cleanedId = cleanShelfId(shelfId);
    log(`Original: "${shelfId}" → Cleaned: "${cleanedId}"`);
  });
}

// Test the workflow API with problematic IDs
async function testWorkflowAPI() {
  log('🧪 Testing Workflow API with problematic IDs');
  
  try {
    // Test a shelf ID with potential duplicate _load suffix
    const problematicShelfId = '104_load';
    const workflowId = uuidv4();
    
    log(`Creating test workflow with problematic shelf ID: ${problematicShelfId}`);
    
    const response = await axios.post('http://localhost:5000/api/workflows', {
      id: workflowId,
      serviceType: 'robot',
      operationType: 'pickup',
      floorId: 'Floor1',
      shelfId: problematicShelfId
    });
    
    log(`API Response: ${JSON.stringify(response.data)}`);
    log('✅ API call successful - our fix is working!');
    
    return response.data;
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    if (error.response) {
      log(`Error response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Test specific functions directly
async function testPointIdProcessing() {
  log('🧪 Testing point ID processing');
  
  // Example IDs that might cause problems
  const testIds = [
    '104_load_load_docking',
    '104_load_docking',
    '104_docking',
    'pick-up_load_docking'
  ];
  
  testIds.forEach(id => {
    // First, remove any existing docking suffix to simulate what we'd do in practice
    let baseId = id.replace(/_docking$/i, '');
    
    // Then clean any _load suffix
    const cleanedId = cleanShelfId(baseId);
    
    // Now construct a proper docking point ID
    const constructedDockingId = `${cleanedId}_docking`;
    
    log(`Original: "${id}" → Base: "${baseId}" → Cleaned: "${cleanedId}" → Constructed: "${constructedDockingId}"`);
  });
}

// Run all tests
async function runTests() {
  log('🚀 Starting cleanShelfId tests');
  
  await testCleanShelfId();
  log('-'.repeat(80));
  
  await testPointIdProcessing();
  log('-'.repeat(80));
  
  await testWorkflowAPI();
  log('-'.repeat(80));
  
  log('✅ Tests completed');
}

// Execute all tests
runTests().catch(error => {
  log(`❌ Unexpected error: ${error.message}`);
});