// client/src/hooks/use-mission-status.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

export interface MissionStep {
  type: 'move' | 'jack_up' | 'jack_down';
  params: Record<string, any>;
  completed: boolean;
  robotResponse?: any;
  errorMessage?: string;
  retryCount: number;
}

export interface Mission {
  id: string;
  name: string;
  steps: MissionStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  offline?: boolean;
  robotSn: string;
}

export function useMissionStatus(missionId?: string) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);

  // Fetch a specific mission by ID
  const fetchMission = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/missions/${id}`);
      setMission(response.data);
    } catch (err: any) {
      console.error('Error fetching mission:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all active missions
  const fetchActiveMissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/missions/active');
      setActiveMissions(response.data);
    } catch (err: any) {
      console.error('Error fetching active missions:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Clear completed missions
  const clearCompletedMissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await axios.post('/api/missions/clear-completed');
      // Refresh mission lists after clearing
      fetchActiveMissions();
    } catch (err: any) {
      console.error('Error clearing completed missions:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Refetch mission data
  const refetch = () => {
    if (missionId) {
      fetchMission(missionId);
    }
    fetchActiveMissions();
  };

  // Initial fetch when mission ID changes
  useEffect(() => {
    if (missionId) {
      fetchMission(missionId);
    }
  }, [missionId]);

  // Initial fetch of active missions
  useEffect(() => {
    fetchActiveMissions();
    
    // Set up polling for active missions
    const interval = setInterval(fetchActiveMissions, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    mission,
    activeMissions,
    loading,
    error,
    refetch,
    clearCompletedMissions
  };
}