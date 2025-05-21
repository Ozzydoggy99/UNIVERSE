import { getRobotApiUrl, getAuthHeaders } from './robot-constants';
import axios from 'axios';

interface PointSet {
  id: string;
  name: string;
  points: Array<{ x: number; y: number; z: number }>;
}

interface SimplifiedPoint {
  displayName: string;
  pointSets: string[];
}

// Cache for point sets to avoid frequent API calls
let pointSetsCache: PointSet[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all point sets from the robot
 */
export async function fetchPointSets(): Promise<PointSet[]> {
  const now = Date.now();
  if (pointSetsCache.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
    return pointSetsCache;
  }

  try {
    const apiUrl = await getRobotApiUrl('L382502104987ir');
    const response = await axios.get(`${apiUrl}/points`, {
      headers: await getAuthHeaders('L382502104987ir')
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from points endpoint');
    }

    pointSetsCache = response.data;
    lastFetchTime = now;
    return pointSetsCache;
  } catch (error) {
    console.error('Error fetching point sets:', error);
    throw error;
  }
}

/**
 * Extract the base point name from a point set name
 * Example: "110_load" -> "110"
 */
function extractBasePointName(pointSetName: string): string {
  // Match numbers at the start of the string
  const match = pointSetName.match(/^\d+/);
  return match ? match[0] : pointSetName;
}

/**
 * Group point sets by their base name
 * Example: ["110_load", "110_load_docking"] -> { "110": ["110_load", "110_load_docking"] }
 */
export async function getSimplifiedPoints(): Promise<SimplifiedPoint[]> {
  const pointSets = await fetchPointSets();
  const pointGroups = new Map<string, string[]>();

  // Group point sets by their base name
  pointSets.forEach(pointSet => {
    const baseName = extractBasePointName(pointSet.name);
    const existing = pointGroups.get(baseName) || [];
    pointGroups.set(baseName, [...existing, pointSet.name]);
  });

  // Convert to array format
  return Array.from(pointGroups.entries()).map(([displayName, pointSets]) => ({
    displayName,
    pointSets
  }));
}

/**
 * Get all point sets for a given display name
 * Example: "110" -> ["110_load", "110_load_docking"]
 */
export async function getPointSetsForDisplayName(displayName: string): Promise<string[]> {
  const pointSets = await fetchPointSets();
  return pointSets
    .filter(pointSet => extractBasePointName(pointSet.name) === displayName)
    .map(pointSet => pointSet.name);
}

/**
 * Check if a point set exists
 */
export async function pointSetExists(pointSetName: string): Promise<boolean> {
  const pointSets = await fetchPointSets();
  return pointSets.some(pointSet => pointSet.name === pointSetName);
}

/**
 * Get the full point set data for a given point set name
 */
export async function getPointSetData(pointSetName: string): Promise<PointSet | null> {
  const pointSets = await fetchPointSets();
  return pointSets.find(pointSet => pointSet.name === pointSetName) || null;
} 