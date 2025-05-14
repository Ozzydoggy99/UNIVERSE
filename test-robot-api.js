/**
 * Robot API Diagnostic Tool
 * 
 * This script attempts to connect to the robot using various known API endpoints
 * and reports which ones are accessible. This helps diagnose connectivity issues
 * or changes in the robot's API structure.
 * 
 * Run with: node test-robot-api.js
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const ROBOT_IP = process.env.ROBOT_IP || '47.180.91.99';
const ROBOT_PORT = process.env.ROBOT_PORT || '8090';
const ROBOT_SECRET = process.env.ROBOT_SECRET_KEY || 'APPCODE 667a51a4d948433081a272c78d10a8a4';
const ROBOT_SERIAL = 'L382502104987ir';

// All possible base URLs to test
const BASE_URLS = [
  `http://${ROBOT_IP}:${ROBOT_PORT}`,
  `http://${ROBOT_IP}:${ROBOT_PORT}/api`,
  `http://${ROBOT_IP}:${ROBOT_PORT}/v1`,
  `http://${ROBOT_IP}:${ROBOT_PORT}/api/v1`,
  `http://${ROBOT_IP}:${ROBOT_PORT}/api/v2`,
];

// Headers to try
const HEADERS_TO_TEST = [
  { 'Secret': ROBOT_SECRET },
  { 'Authorization': ROBOT_SECRET },
  { 'APPCODE': ROBOT_SECRET.replace('APPCODE ', '') },
  { 'X-Auth-Token': ROBOT_SECRET },
  {},  // Try with no auth headers as well
];

// API endpoints to test
const ENDPOINTS_TO_TEST = [
  '/tracked_pose',
  '/chassis/moves/latest',
  '/services/jack_down',
  '/services/return_to_charger',
  '/charge',
  '/getCurrentPose',
  '/position',
  '/api/v1/pose',
  '/api/v2/position',
  '/robot/pose',
  '/move/to',
  '/robot/current_pose',
  '/status',
  '/robot/status',
  '/device/info',
  '/device/status',
  '/tasks/current',
  '/maps',
  '/maps/current',
  '/api/maps',
  // Common health check endpoints
  '/health',
  '/ping',
  '/api/ping',
  '/status/health',
  '/api/health',
];

// Function to test a specific URL with specific headers
async function testEndpoint(baseUrl, endpoint, headers) {
  const url = `${baseUrl}${endpoint}`;
  try {
    console.log(`Testing ${url}...`);
    const response = await axios.get(url, { 
      headers,
      timeout: 1000,  // 1-second timeout to avoid hanging
    });

    if (response.status === 200) {
      console.log(`✅ SUCCESS - ${url}`);
      console.log('  Status:', response.status);
      console.log('  Headers used:', JSON.stringify(headers));
      try {
        console.log('  Response sample:', JSON.stringify(response.data).substring(0, 100) + '...');
      } catch (e) {
        console.log('  Response: [Could not stringify]');
      }
      console.log('');
      return true;
    } else {
      console.log(`⚠️ NON-200 RESPONSE - ${url}`);
      console.log('  Status:', response.status);
      console.log('');
      return false;
    }
  } catch (error) {
    if (error.response) {
      // Request was made and server responded with error status
      console.log(`ℹ️ ${error.response.status} - ${url}`);
    } else if (error.request) {
      // Request was made but no response was received
      console.log(`❌ NO RESPONSE - ${url}`);
    } else {
      // Something else happened
      console.log(`❌ ERROR - ${url}: ${error.message}`);
    }
    return false;
  }
}

// Main function to test all combinations
async function runTests() {
  console.log('=== ROBOT API DIAGNOSTIC TOOL ===');
  console.log(`Testing connectivity to robot at ${ROBOT_IP}:${ROBOT_PORT}`);
  console.log(`Serial number: ${ROBOT_SERIAL}`);
  console.log(`Secret key: ${ROBOT_SECRET.substring(0, 10)}...`);
  console.log('Testing various API endpoints...\n');

  // First, test basic connectivity to the robot
  try {
    await axios.get(`http://${ROBOT_IP}:${ROBOT_PORT}`, { timeout: 2000 });
    console.log(`✅ Robot is reachable at http://${ROBOT_IP}:${ROBOT_PORT}\n`);
  } catch (error) {
    console.log(`⚠️ WARNING: Could not reach robot at http://${ROBOT_IP}:${ROBOT_PORT}`);
    console.log('  This may indicate the robot is offline, the IP address is wrong,');
    console.log('  or a firewall is blocking access.\n');
  }

  // Test all combinations of base URLs, endpoints, and headers
  const successfulCombinations = [];
  const testedCombinations = [];

  for (const baseUrl of BASE_URLS) {
    for (const endpoint of ENDPOINTS_TO_TEST) {
      for (const headers of HEADERS_TO_TEST) {
        const combo = `${baseUrl}${endpoint} with ${Object.keys(headers).length ? Object.keys(headers)[0] : 'no auth'}`;
        testedCombinations.push(combo);
        
        const success = await testEndpoint(baseUrl, endpoint, headers);
        if (success) {
          successfulCombinations.push(combo);
        }
      }
    }
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total combinations tested: ${testedCombinations.length}`);
  console.log(`Successful combinations: ${successfulCombinations.length}`);
  console.log('');
  
  if (successfulCombinations.length > 0) {
    console.log('Successful endpoints:');
    successfulCombinations.forEach(combo => {
      console.log(`- ${combo}`);
    });
  } else {
    console.log('❌ No successful API endpoints found.');
    console.log('  Possible issues:');
    console.log('  1. Robot is offline or IP address is incorrect');
    console.log('  2. Authentication method has changed');
    console.log('  3. API endpoint structure has changed');
    console.log('  4. Network connectivity issues or firewalls');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
});