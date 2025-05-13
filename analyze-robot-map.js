#!/usr/bin/env node

/**
 * Robot Map Analyzer
 * 
 * This script connects to the robot, retrieves all maps and points, and analyzes
 * them based on our standard naming convention for maps and points.
 * 
 * It will identify:
 * - Maps following our naming convention (Floor1, Floor2, BasementODT)
 * - Points categorized by type (shelf, pickup, dropoff, etc.)
 * - Validation of naming convention compliance
 */

import axios from 'axios';

// Use our local API which has proper error handling and fallbacks
const API_BASE_URL = 'http://localhost:5000';

/**
 * Extracts the floor number from a shelf point ID
 */
function getFloorFromShelfPoint(pointId) {
  // Ensure it's a shelf point (not a pickup or dropoff)
  if (pointId.startsWith('pick-up') || pointId.startsWith('drop-off')) {
    return null;
  }
  
  // Extract the first digit which indicates floor
  const match = pointId.match(/^(\d)/);
  if (!match) return null;
  
  return parseInt(match[1], 10);
}

/**
 * Determines if a point is a shelf point
 */
function isShelfPoint(pointId) {
  // Shelf points start with a number and end with _load
  return /^\d+_load$/.test(pointId);
}

/**
 * Determines if a point is a pickup point
 */
function isPickupPoint(pointId) {
  return pointId.startsWith('pick-up') && pointId.endsWith('_load');
}

/**
 * Determines if a point is a dropoff point
 */
function isDropoffPoint(pointId) {
  return pointId.startsWith('drop-off') && pointId.endsWith('_load');
}

/**
 * Gets the docking point ID for a load point
 */
function getDockingPointId(loadPointId) {
  // If it's already a docking point, return as is
  if (loadPointId.endsWith('_docking')) {
    return loadPointId;
  }
  
  // Otherwise, append _docking to the point ID
  return `${loadPointId}_docking`;
}

/**
 * Gets the base point ID for a docking point
 */
function getBasePointId(dockingPointId) {
  // If it's a docking point, remove the _docking suffix
  if (dockingPointId.endsWith('_load_docking')) {
    return dockingPointId.replace('_docking', '');
  }
  
  // Otherwise, return as is
  return dockingPointId;
}

/**
 * Categorize a point based on our naming convention
 */
function categorizePoint(pointId) {
  if (isShelfPoint(pointId)) {
    return 'shelf_load';
  } else if (pointId.endsWith('_load_docking')) {
    if (isPickupPoint(getBasePointId(pointId))) {
      return 'pickup_docking';
    } else if (isDropoffPoint(getBasePointId(pointId))) {
      return 'dropoff_docking';
    } else {
      return 'shelf_docking';
    }
  } else if (isPickupPoint(pointId)) {
    return 'pickup';
  } else if (isDropoffPoint(pointId)) {
    return 'dropoff';
  } else if (pointId.startsWith('charger')) {
    return 'charger';
  } else {
    return 'unknown';
  }
}

/**
 * Get all maps from the robot through our local API
 */
async function getMaps() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/robot/maps`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching maps:', error);
    return [];
  }
}

/**
 * Get all points for a specific map
 * 
 * Note: Our API returns the full map object with an overlays property
 * containing GeoJSON features that represent the points
 */
async function getMapPoints(mapId) {
  try {
    const mapResponse = await axios.get(`${API_BASE_URL}/api/robot/maps/${mapId}/points`);
    
    // Parse the overlays property which contains the GeoJSON features
    const overlaysData = JSON.parse(mapResponse.data.overlays || '{"features":[]}');
    
    // Extract only the point features
    const pointFeatures = overlaysData.features.filter(feature => 
      feature.geometry.type === 'Point'
    );
    
    // Convert to our expected format
    return pointFeatures.map(feature => ({
      id: feature.properties.name || 'unnamed',
      x: feature.geometry.coordinates[0],
      y: feature.geometry.coordinates[1],
      theta: parseFloat(feature.properties.yaw || '0')
    }));
  } catch (error) {
    console.error(`Error fetching points for map ${mapId}:`, error);
    return [];
  }
}

/**
 * Main function to analyze robot maps
 */
async function analyzeRobotMaps() {
  try {
    console.log('Analyzing robot maps and points...');
    
    // Get all maps
    const maps = await getMaps();
    console.log(`Found ${maps.length} maps on the robot`);
    
    // Filter for maps with our naming convention
    const standardMaps = maps.filter(map => 
      (map.map_name && map.map_name.startsWith('Floor')) || 
      (map.map_name === 'BasementODT')
    );
    
    console.log(`Found ${standardMaps.length} maps with standard naming convention`);
    
    if (standardMaps.length === 0) {
      // Show all available maps
      console.log('\n=== ALL AVAILABLE MAPS ===');
      maps.forEach((map, index) => {
        console.log(`${index + 1}. ${map.map_name || map.name || 'Unnamed'} (ID: ${map.id}, UID: ${map.uid})`);
      });
      
      console.log('\nNo maps found with standard naming convention. Please rename maps to follow our convention (Floor1, Floor2, BasementODT).');
      return;
    }
    
    // Process each map
    for (const map of standardMaps) {
      console.log(`\n--- ANALYZING MAP: ${map.map_name} (ID: ${map.id}) ---`);
      
      // Get points for this map
      const points = await getMapPoints(map.id);
      console.log(`Found ${points.length} points on map ${map.map_name}`);
      
      if (points.length === 0) {
        console.log(`No points found on map ${map.map_name}. Please add points to this map.`);
        continue;
      }
      
      // Categorize points
      const processedPoints = points.map(point => ({
        ...point,
        category: categorizePoint(point.id)
      }));
      
      // Count points by category
      const categories = {};
      processedPoints.forEach(point => {
        categories[point.category] = (categories[point.category] || 0) + 1;
      });
      
      console.log('\nPoint Categories:');
      Object.entries(categories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
      
      // Group shelf points by floor
      const shelfPointsByFloor = {};
      
      processedPoints.forEach(point => {
        if (point.category === 'shelf_load') {
          const floor = getFloorFromShelfPoint(point.id);
          if (floor !== null) {
            shelfPointsByFloor[floor] = shelfPointsByFloor[floor] || [];
            shelfPointsByFloor[floor].push(point);
          }
        }
      });
      
      // Find matching pairs (load points and their docking points)
      const matchingPairs = [];
      const unmatchedLoadPoints = [];
      
      const loadPoints = processedPoints.filter(p => 
        p.category === 'shelf_load' || 
        p.category === 'pickup' || 
        p.category === 'dropoff'
      );
      
      loadPoints.forEach(loadPoint => {
        const dockingPointId = getDockingPointId(loadPoint.id);
        const dockingPoint = processedPoints.find(p => p.id === dockingPointId);
        
        if (dockingPoint) {
          matchingPairs.push({
            load: loadPoint,
            docking: dockingPoint
          });
        } else {
          unmatchedLoadPoints.push(loadPoint);
        }
      });
      
      console.log(`\nMatching Pairs (load + docking): ${matchingPairs.length}`);
      console.log(`Unmatched Load Points: ${unmatchedLoadPoints.length}`);
      
      if (unmatchedLoadPoints.length > 0) {
        console.log('\nWARNING: The following load points are missing their corresponding docking points:');
        unmatchedLoadPoints.forEach(point => {
          console.log(`  ${point.id} (missing ${getDockingPointId(point.id)})`);
        });
      }
      
      // Show shelf points by floor
      console.log('\nShelf Points by Floor:');
      if (Object.keys(shelfPointsByFloor).length > 0) {
        Object.entries(shelfPointsByFloor).forEach(([floor, points]) => {
          console.log(`  Floor ${floor}: ${points.length} shelf points`);
          points.forEach(point => {
            console.log(`    - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
          });
        });
      } else {
        console.log('  No shelf points found');
      }
      
      // Show pickup points
      const pickupPoints = processedPoints.filter(p => p.category === 'pickup');
      if (pickupPoints.length > 0) {
        console.log('\nPickup Points:');
        pickupPoints.forEach(point => {
          console.log(`  - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
        });
      }
      
      // Show dropoff points
      const dropoffPoints = processedPoints.filter(p => p.category === 'dropoff');
      if (dropoffPoints.length > 0) {
        console.log('\nDropoff Points:');
        dropoffPoints.forEach(point => {
          console.log(`  - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
        });
      }
      
      // Show charger points
      const chargerPoints = processedPoints.filter(p => p.category === 'charger');
      if (chargerPoints.length > 0) {
        console.log('\nCharger Points:');
        chargerPoints.forEach(point => {
          console.log(`  - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
        });
      }
      
      // Show unknown points
      const unknownPoints = processedPoints.filter(p => p.category === 'unknown');
      if (unknownPoints.length > 0) {
        console.log('\nUnknown Points (not following naming convention):');
        unknownPoints.forEach(point => {
          console.log(`  - ${point.id} (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
        });
      }
    }
    
    console.log('\n=== ANALYSIS COMPLETE ===');
    
  } catch (error) {
    console.error('Error analyzing robot maps:', error);
  }
}

// Execute the main function
analyzeRobotMaps();