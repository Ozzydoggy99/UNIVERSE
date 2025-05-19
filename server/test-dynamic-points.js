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
    
    // Test specifically for the "110_load" point that may have been newly added to the robot map
    const testPointId = "110_load";
    console.log(`Testing point ID: ${testPointId}`);
    
    // Call our new dynamic points API endpoint
    // Try direct API call to the robot instead
    console.log(`Testing direct API call to the robot for point: ${testPointId}`);
    
    // First verify our robot-live-points service is working by directly importing it
    // Since we're using ES modules, we need to import not require
    import { getPointById, fetchRobotPoints } from './robot-live-points';
    
    // Fetch all points to see what we have
    console.log("Fetching all robot map points...");
    const allPoints = await fetchRobotPoints();
    console.log(`Found ${allPoints.length} points on the robot map`);
    
    if (allPoints.length > 0) {
      console.log("Sample points:", allPoints.slice(0, 3));
    }
    
    // Now look for our specific point
    console.log(`Looking for specific point: ${testPointId}`);
    const point = await getPointById(testPointId);
    
    // Manually construct a response similar to what the API would return
    const response = {
      data: {
        success: true,
        found: !!point,
        point: point
      }
    };
    
    if (response.data && response.data.found) {
      console.log(`✅ SUCCESS: Point ${testPointId} found with coordinates:`, response.data.point);
      console.log("The system is correctly detecting newly added map points!");
      
      // Test the to-unload-point action directly
      const unloadTestResponse = await axios.post(`http://localhost:4444/api/robot/test-unload-action`, {
        pointId: testPointId
      });
      
      console.log("Unload point action test result:", unloadTestResponse.data);
      
    } else {
      console.error(`❌ ERROR: Point ${testPointId} not found`);
      console.error("The dynamic point detection system may not be working properly.");
      console.log("Trying alternate formats...");
      
      // Try the numeric-only version
      const numericId = testPointId.replace('_load', '');
      console.log(`Testing numeric ID: ${numericId}`);
      
      const numericResponse = await axios.get(`http://localhost:4444/api/dynamic-points/${numericId}`);
      
      if (numericResponse.data && numericResponse.data.found) {
        console.log(`✅ SUCCESS: Numeric point ${numericId} found with coordinates:`, numericResponse.data.point);
      } else {
        console.error(`❌ ERROR: Numeric point ${numericId} not found either`);
      }
    }
    
    // Test the general API endpoint that should list all available points
    console.log("\nFetching all available dynamic points...");
    const allPointsResponse = await axios.get(`http://localhost:4444/api/dynamic-points`);
    
    if (allPointsResponse.data && allPointsResponse.data.points) {
      console.log(`Found ${allPointsResponse.data.points.length} points in total`);
      console.log("Sample of available points:", allPointsResponse.data.points.slice(0, 5));
    } else {
      console.error("Could not retrieve all points");
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