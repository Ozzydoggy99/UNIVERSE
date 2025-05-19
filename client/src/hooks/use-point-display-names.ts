// client/src/hooks/use-point-display-names.ts
import { useQuery } from '@tanstack/react-query';

export interface PointDisplayMapping {
  technicalId: string;    // Internal ID used by system (e.g., "001_load")
  displayName: string;    // User-friendly name shown in UI (e.g., "Dropoff")
  pointType: 'pickup' | 'dropoff' | 'shelf' | 'charger'; // Type of point
}

/**
 * Hook to fetch and utilize point display mappings for user-friendly names
 * 
 * This hook provides functions to translate between technical point IDs (e.g., "001_load")
 * and user-friendly display names (e.g., "Dropoff") shown in the UI.
 */
export function usePointDisplayNames() {
  const { data: mappings, isLoading, error } = useQuery<PointDisplayMapping[]>({
    queryKey: ['/api/robots/points/display-mappings'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Get a user-friendly display name for a technical point ID
   */
  const getDisplayName = (technicalId: string): string => {
    if (!mappings || isLoading) return technicalId;
    
    const mapping = mappings.find(m => m.technicalId === technicalId);
    return mapping ? mapping.displayName : technicalId;
  };

  /**
   * Get the technical ID from a user-friendly display name
   */
  const getTechnicalId = (displayName: string): string => {
    if (!mappings || isLoading) return displayName;
    
    const mapping = mappings.find(m => m.displayName === displayName);
    return mapping ? mapping.technicalId : displayName;
  };

  /**
   * Get all point mappings of a specific type
   */
  const getPointsByType = (type: 'pickup' | 'dropoff' | 'shelf' | 'charger'): PointDisplayMapping[] => {
    if (!mappings || isLoading) return [];
    
    return mappings.filter(m => m.pointType === type);
  };

  return {
    mappings,
    isLoading,
    error,
    getDisplayName,
    getTechnicalId,
    getPointsByType
  };
}