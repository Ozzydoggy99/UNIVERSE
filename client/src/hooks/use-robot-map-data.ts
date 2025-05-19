// client/src/hooks/use-robot-map-data.ts
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Point } from '../types/robot';

export interface RobotMapData {
  shelvesByFloor: Record<string, Point[]>;
  specialPoints: {
    pickup?: Point;
    dropoff?: Point;
    standby?: Point;
  };
  allFloors: string[];
  allPoints?: Point[];
  namedPoints?: Point[];
  numericPoints?: Point[];
}

export function useRobotMapData() {
  const { data, isLoading, error } = useQuery<RobotMapData>({
    queryKey: ['/api/robots/points/full'],
    staleTime: 60000, // 1 minute
  });
  
  // Process the data to extract different point types for UI use
  const processedData = {
    specialPoints: data?.specialPoints || { pickup: undefined, dropoff: undefined, standby: undefined },
    allPoints: extractAllPoints(data),
    namedPoints: extractNamedPoints(data),
    numericPoints: extractNumericPoints(data),
    shelvesByFloor: data?.shelvesByFloor || {},
    allFloors: data?.allFloors || [],
  };
  
  return { 
    ...processedData,
    isLoading, 
    error,
  };
}

// Helper functions to process point data
function extractAllPoints(data: RobotMapData | undefined): Point[] {
  if (!data) return [];
  
  const points: Point[] = [];
  // Add special points
  if (data.specialPoints.pickup) points.push(data.specialPoints.pickup);
  if (data.specialPoints.dropoff) points.push(data.specialPoints.dropoff);
  if (data.specialPoints.standby) points.push(data.specialPoints.standby);
  
  // Add shelf points from all floors
  Object.values(data.shelvesByFloor).forEach(floorPoints => {
    points.push(...floorPoints);
  });
  
  return points;
}

function extractNamedPoints(data: RobotMapData | undefined): Point[] {
  const points = extractAllPoints(data);
  return points.filter(p => isNaN(parseInt(p.id)));
}

function extractNumericPoints(data: RobotMapData | undefined): Point[] {
  const points = extractAllPoints(data);
  return points.filter(p => !isNaN(parseInt(p.id)));
}