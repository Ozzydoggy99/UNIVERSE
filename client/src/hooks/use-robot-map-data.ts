// client/src/hooks/use-robot-map-data.ts
import { useEffect, useState } from 'react';
import { Point } from '../types/robot';

export interface RobotMapData {
  shelvesByFloor: Record<string, Point[]>;
  specialPoints: {
    pickup?: Point;
    dropoff?: Point;
    standby?: Point;
  };
  allFloors: string[];
}

export function useRobotMapData() {
  const [data, setData] = useState<RobotMapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/robots/points/full');
        if (!res.ok) throw new Error(`Failed to fetch map data: ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error('❌ useRobotMapData error:', err);
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { data, loading, error };
}