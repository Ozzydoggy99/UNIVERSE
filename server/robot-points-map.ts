/**
 * Standardized map of robot points based on our naming convention
 * 
 * This file is used by the workflow system to locate and interact with points
 * across the different maps in the robot.
 */

// Point coordinates type
export interface Point {
  x: number;
  y: number;
  theta: number;
}

// Floor data type
export interface Floor {
  mapId: number;
  mapName: string;
  points: Record<string, Point>;
  charger: Point;
}

// Robot points map type
export interface RobotPointsMap {
  floors: Record<number, Floor>;
  getPoint: (floorId: number, pointName: string) => Point;
  getCharger: (floorId: number) => Point;
  getMapId: (floorId: number) => number;
  getFloorIds: () => number[];
  getShelfPointNames: (floorId: number) => string[];
  getShelfNumber: (shelfPointName: string) => number;
  getDockingPointName: (loadPointName: string) => string;
}

// Contains data retrieved from analyze-robot-map.js
const robotPointsMap: RobotPointsMap = {
  floors: {
    // Floor1 is our main operational floor
    1: {
      mapId: 4,
      mapName: 'Floor1',
      points: {
        // Central pickup and dropoff points
        'pick-up_load': {
          x: -2.847, 
          y: 2.311, 
          theta: 0.0
        },
        'pick-up_load_docking': {
          x: -1.887,
          y: 2.311,
          theta: 0.0
        },
        'drop-off_load': {
          x: -2.861,
          y: 3.383,
          theta: 0.0
        },
        'drop-off_load_docking': {
          x: -1.850,
          y: 3.366,
          theta: 0.0
        },
        
        // Shelf points on floor 1
        '104_load': {
          x: -15.880,
          y: 6.768,
          theta: 0.0
        },
        '104_load_docking': {
          x: -14.801,
          y: 6.768,
          theta: 0.0
        },
        '112_load': {
          x: 1.406,
          y: 4.496,
          theta: 180.0
        },
        '112_load_docking': {
          x: 0.378,
          y: 4.529,
          theta: 0.0
        },
        '115_load': {
          x: -8.029,
          y: 6.704,
          theta: 0.0
        },
        '115_load_docking': {
          x: -6.917,
          y: 6.721,
          theta: 0.0
        }
      },
      // Charger location on this floor
      charger: {
        x: 0.034,
        y: 0.498,
        theta: 266.11
      }
    }
  },
  
  // Get point coordinates by floor ID and point name
  getPoint: function(floorId: number, pointName: string): Point {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    if (!this.floors[floorId].points[pointName]) {
      throw new Error(`Point ${pointName} not found on floor ${floorId}`);
    }
    
    return this.floors[floorId].points[pointName];
  },
  
  // Get charger coordinates for a specific floor
  getCharger: function(floorId: number): Point {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    if (!this.floors[floorId].charger) {
      throw new Error(`No charger found on floor ${floorId}`);
    }
    
    return this.floors[floorId].charger;
  },
  
  // Get map ID for a specific floor
  getMapId: function(floorId: number): number {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    return this.floors[floorId].mapId;
  },
  
  // Get all available floor IDs
  getFloorIds: function(): number[] {
    return Object.keys(this.floors).map(id => parseInt(id, 10));
  },
  
  // Get all shelf point names for a specific floor
  getShelfPointNames: function(floorId: number): string[] {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    
    return Object.keys(this.floors[floorId].points)
      .filter(pointName => /^\d+_load$/.test(pointName));
  },
  
  // Extract the shelf number from a shelf point name (e.g., "104_load" -> 104)
  getShelfNumber: function(shelfPointName: string): number {
    if (!shelfPointName.endsWith('_load')) {
      throw new Error(`${shelfPointName} is not a valid shelf point name`);
    }
    
    return parseInt(shelfPointName.replace('_load', ''), 10);
  },
  
  // Get the docking point name for a load point
  getDockingPointName: function(loadPointName: string): string {
    if (!loadPointName.endsWith('_load')) {
      throw new Error(`${loadPointName} is not a valid load point name`);
    }
    
    return `${loadPointName}_docking`;
  }
};

export default robotPointsMap;