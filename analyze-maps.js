/**
 * A utility script to analyze robot maps and points according to our naming convention
 * 
 * This script connects to the robot, retrieves all maps and points, and analyzes
 * them based on our standard naming convention for maps and points.
 * 
 * Usage: node analyze-maps.js
 * 
 * The script will:
 * 1. Fetch all maps from the robot
 * 2. Identify maps that follow our convention (Floor1, Floor2, BasementODT)
 * 3. Get all points on each map
 * 4. Categorize and analyze the points based on our naming convention
 * 5. Display a detailed summary of the findings
 */

import { analyzeRobotMaps } from './server/map-analyzer.js';

async function main() {
  try {
    console.log('Starting map analysis...');
    const results = await analyzeRobotMaps();
    
    console.log('\n=== MAP ANALYSIS RESULTS ===\n');
    console.log(`Total maps on robot: ${results.totalMaps}`);
    console.log(`Maps with standard naming (Floor1, Floor2, etc.): ${results.standardMaps}`);
    
    if (results.mapDetails && results.mapDetails.length > 0) {
      results.mapDetails.forEach((mapDetail, index) => {
        console.log(`\n--- MAP ${index + 1}: ${mapDetail.map.name} ---`);
        console.log(`  Map UID: ${mapDetail.map.uid}`);
        console.log('  Point Summary:');
        console.log(`    Total Points: ${mapDetail.summary.totalPoints}`);
        console.log(`    Shelf Points: ${mapDetail.summary.shelfPoints}`);
        console.log(`    Shelf Docking Points: ${mapDetail.summary.shelfDockingPoints}`);
        console.log(`    Pickup Points: ${mapDetail.summary.pickupPoints}`);
        console.log(`    Pickup Docking Points: ${mapDetail.summary.pickupDockingPoints}`);
        console.log(`    Dropoff Points: ${mapDetail.summary.dropoffPoints}`);
        console.log(`    Dropoff Docking Points: ${mapDetail.summary.dropoffDockingPoints}`);
        console.log(`    Charger Points: ${mapDetail.summary.chargerPoints}`);
        console.log(`    Unknown Points: ${mapDetail.summary.unknownPoints}`);
        console.log(`    Complete Pairs (load + docking): ${mapDetail.summary.matchingPairsCount}`);
        
        // Show shelf points by floor
        console.log('\n  Shelf Points by Floor:');
        if (Object.keys(mapDetail.shelfPointsByFloor).length > 0) {
          Object.entries(mapDetail.shelfPointsByFloor).forEach(([floor, points]) => {
            console.log(`    Floor ${floor}: ${points.length} shelf points`);
            points.forEach(point => {
              console.log(`      - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
            });
          });
        } else {
          console.log('    No shelf points found');
        }
        
        // List all categorized points
        console.log('\n  All Points:');
        mapDetail.points.forEach(point => {
          console.log(`    - [${point.category}] ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
        });
      });
    } else {
      console.log('\nNo maps found with standard naming convention.');
      console.log('Please ensure maps are named following our convention (Floor1, Floor2, BasementODT).');
    }
  } catch (error) {
    console.error('Error analyzing maps:', error);
  }
}

main();