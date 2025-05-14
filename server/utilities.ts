/**
 * Utility functions for the robot management system
 */

// We'll use this function to handle errors in a type-safe way
export function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper to check if an ID contains a specific pattern (case-insensitive)
export function idContains(id: string, pattern: string): boolean {
  return id.toLowerCase().includes(pattern.toLowerCase());
}

// Helper to normalize point IDs for consistent lookup
export function normalizePointId(id: string): string {
  return id.toLowerCase();
}

// Helper to get various case forms of a point ID to try matching
export function getPointIdVariations(id: string): string[] {
  return [
    id,                          // Original form
    id.toLowerCase(),            // All lowercase
    id.toUpperCase(),            // All uppercase
    id.charAt(0).toUpperCase() + id.slice(1).toLowerCase() // First letter capital
  ];
}

// Helper to sleep/wait for a specified time (ms)
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}