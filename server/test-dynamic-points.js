/**
 * Test script for dynamic point detection
 * 
 * This script tests the system's ability to automatically detect and use
 * newly added points on the robot map without requiring code changes.
 */

import axios from 'axios';

async function testDynamicPointDetection() {
  try {
    console.log("Testing dynamic point detection...");
    
    // Test specifically for the "110_load" point
    const testPointId = "110_load";
    console.log(`Testing point ID: ${testPointId}`);
    
    // Call our dynamic point service endpoint
    const response = await axios.get(`http://localhost:3000/api/dynamic-points/${testPointId}`);
    
    if (response.data && response.data.found) {
      console.log(`✅ SUCCESS: Point ${testPointId} found with coordinates:`, response.data.point);
      console.log("The system is correctly detecting newly added map points!");
    } else {
      console.error(`❌ ERROR: Point ${testPointId} not found`);
      console.error("The dynamic point detection system may not be working properly.");
    }
  } catch (error) {
    console.error("Error during dynamic point test:", error.message);
    
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Run the test
testDynamicPointDetection();

// Make this an ES module
export {};