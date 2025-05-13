import axios from 'axios';
import { 
  getFloorFromShelfPoint, 
  isShelfPoint, 
  isPickupPoint, 
  isDropoffPoint,
  getDockingPointId,
  getBasePointId,
  getShelfNumber
} from './robot-point-utilities';

// Robot API base URL
const ROBOT_API_URL = 'http://47.180.91.99:8090';

/**
 * Map type with points
 */
interface Map {
  uid: string;
  name: string;
  points: Point[];
}

/**
 * Point type
 */
interface Point {
  id: string;
  x: number;
  y: number;
  theta: number;
  category?: string; // Calculated category based on our naming convention
}

/**
 * Get all maps from the robot
 */
async function getMaps(): Promise<Map[]> {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/api/v2/maps`);
    return response.data.maps || [];
  } catch (error) {
    console.error('Error fetching maps:', error);
    return [];
  }
}

/**
 * Get all points for a specific map
 */
async function getMapPoints(mapUid: string): Promise<Point[]> {
  try {
    const response = await axios.get(`${ROBOT_API_URL}/api/v2/maps/${mapUid}/points`);
    return response.data.points || [];
  } catch (error) {
    console.error(`Error fetching points for map ${mapUid}:`, error);
    return [];
  }
}

/**
 * Categorize a point based on our naming convention
 */
function categorizePoint(pointId: string): string {
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
 * Analyze maps and points according to our naming convention
 */
export async function analyzeRobotMaps(): Promise<Record<string, any>> {
  try {
    console.log('Analyzing robot maps and points...');
    
    // Get all maps
    const maps = await getMaps();
    console.log(`Found ${maps.length} maps`);
    
    // Filter for maps with our naming convention
    const standardMaps = maps.filter(map => 
      map.name.startsWith('Floor') || map.name === 'BasementODT'
    );
    
    console.log(`Found ${standardMaps.length} maps with standard naming convention`);
    
    // Process each map
    const mapAnalysis = await Promise.all(standardMaps.map(async map => {
      // Get points for this map
      const points = await getMapPoints(map.uid);
      
      // Categorize points
      const processedPoints = points.map(point => ({
        ...point,
        category: categorizePoint(point.id)
      }));
      
      // Group shelf points by floor
      const shelfPointsByFloor: Record<number, Point[]> = {};
      
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
        }
      });
      
      return {
        map,
        points: processedPoints,
        summary: {
          totalPoints: points.length,
          shelfPoints: processedPoints.filter(p => p.category === 'shelf_load').length,
          shelfDockingPoints: processedPoints.filter(p => p.category === 'shelf_docking').length,
          pickupPoints: processedPoints.filter(p => p.category === 'pickup').length,
          pickupDockingPoints: processedPoints.filter(p => p.category === 'pickup_docking').length,
          dropoffPoints: processedPoints.filter(p => p.category === 'dropoff').length,
          dropoffDockingPoints: processedPoints.filter(p => p.category === 'dropoff_docking').length,
          chargerPoints: processedPoints.filter(p => p.category === 'charger').length,
          unknownPoints: processedPoints.filter(p => p.category === 'unknown').length,
          matchingPairsCount: matchingPairs.length
        },
        shelfPointsByFloor,
        matchingPairs
      };
    }));
    
    return {
      totalMaps: maps.length,
      standardMaps: standardMaps.length,
      mapDetails: mapAnalysis
    };
  } catch (error) {
    console.error('Error analyzing robot maps:', error);
    return {
      error: 'Failed to analyze robot maps',
      message: error.message
    };
  }
}

// Export the main function
export { analyzeRobotMaps };