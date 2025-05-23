/**
 * Map Adapter
 * 
 * This adapter helps transition from the old static map to our new dynamic map sync service.
 * It provides the same interface as the old robot-points-map.ts but uses our new map sync service.
 */

import { getCurrentMapData, getPoint, getMapPoints } from './map-sync-service';
import { pointDisplayMappings } from './robot-points-map';

// Re-export the display mappings since they're still valid
export { pointDisplayMappings };

// Point interface to match the old one
export interface Point {
  x: number;
  y: number;
  theta: number;
}

// Floor interface to match the old one
export interface Floor {
  mapId: number;
  mapName: string;
  points: Record<string, Point>;
  charger: Point;
}

// Robot points map interface to match the old one
export interface RobotPointsMap {
  floors: Record<number, Floor>;
  getPoint: (floorId: number, pointName: string) => Point;
  getCharger: (floorId: number) => Point;
  getMapId: (floorId: number) => number;
  getFloorIds: () => number[];
  getShelfPointNames: (floorId: number) => string[];
  getShelfNumber: (shelfPointName: string) => number;
  getDockingPointName: (loadPointName: string) => string;
  getDisplayName: (technicalId: string) => string;
  getTechnicalIdFromDisplay: (displayName: string) => string;
  addPoint: (floorId: number, pointName: string, point: Point) => void;
  hasPoint: (floorId: number, pointName: string) => boolean;
  refreshPointsFromRobot: () => Promise<void>;
  getPointSets: () => Array<{id: string, loadPoint: string, dockingPoint: string}>;
}

// Create the adapter
const robotPointsMap: RobotPointsMap = {
  floors: {
    1: {
      mapId: 4,
      mapName: 'Floor1',
      points: {},
      charger: {
        x: 0.034,
        y: 0.498,
        theta: 266.11
      }
    }
  },
  
  getPoint: function(floorId: number, pointName: string): Point {
    const point = getPoint(pointName);
    if (!point) {
      throw new Error(`Point ${pointName} not found`);
    }
    return {
      x: point.coordinates[0],
      y: point.coordinates[1],
      theta: point.orientation || 0
    };
  },
  
  getCharger: function(floorId: number): Point {
    return this.floors[floorId].charger;
  },
  
  getMapId: function(floorId: number): number {
    return this.floors[floorId].mapId;
  },
  
  getFloorIds: function(): number[] {
    return Object.keys(this.floors).map(id => parseInt(id, 10));
  },
  
  getShelfPointNames: function(floorId: number): string[] {
    const points = getMapPoints(String(this.floors[floorId].mapId));
    return points
      .filter(p => p.id.endsWith('_load'))
      .map(p => p.id);
  },
  
  getShelfNumber: function(shelfPointName: string): number {
    if (!shelfPointName.endsWith('_load')) {
      throw new Error(`${shelfPointName} is not a valid shelf point name`);
    }
    return parseInt(shelfPointName.replace('_load', ''), 10);
  },
  
  getDockingPointName: function(loadPointName: string): string {
    if (!loadPointName.endsWith('_load')) {
      throw new Error(`${loadPointName} is not a valid load point name`);
    }
    return `${loadPointName}_docking`;
  },
  
  getDisplayName: function(technicalId: string): string {
    const mapping = pointDisplayMappings.find(m => m.technicalId === technicalId);
    return mapping ? mapping.displayName : technicalId;
  },
  
  getTechnicalIdFromDisplay: function(displayName: string): string {
    const mapping = pointDisplayMappings.find(m => m.displayName === displayName);
    return mapping ? mapping.technicalId : displayName;
  },
  
  addPoint: function(floorId: number, pointName: string, point: Point): void {
    if (!this.floors[floorId]) {
      throw new Error(`Floor ${floorId} not found`);
    }
    this.floors[floorId].points[pointName] = point;
  },
  
  hasPoint: function(floorId: number, pointName: string): boolean {
    return !!this.floors[floorId]?.points[pointName];
  },
  
  refreshPointsFromRobot: async function(): Promise<void> {
    // This is now handled by the map sync service
    console.log('Map sync service handles point updates automatically');
  },
  
  getPointSets: function(): Array<{id: string, loadPoint: string, dockingPoint: string}> {
    const points = getMapPoints('4'); // Using map ID 4 for now
    const sets: Array<{id: string, loadPoint: string, dockingPoint: string}> = [];
    
    // Group points into load/docking pairs
    const loadPoints = points.filter(p => p.id.endsWith('_load'));
    for (const loadPoint of loadPoints) {
      const baseId = loadPoint.id.replace('_load', '');
      const dockingPoint = points.find(p => p.id === `${baseId}_load_docking`);
      if (dockingPoint) {
        sets.push({
          id: baseId,
          loadPoint: loadPoint.id,
          dockingPoint: dockingPoint.id
        });
      }
    }
    
    return sets;
  }
};

export default robotPointsMap; 