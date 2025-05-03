import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export type PowerCycleStatus = {
  inProgress: boolean;
  lastAttempt: string;
  success: boolean;
  error?: string;
  remainingTime?: number;
  robotConnected?: boolean;
  recoveryProgress?: number;
  recoveryFailed?: boolean;
  maxRecoveryTime?: number;
};

export type PowerCycleMethod = 'restart' | 'shutdown';

export function usePowerCycle(serialNumber: string) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PowerCycleStatus | null>(null);
  
  const powerCycleMutation = useMutation({
    mutationFn: async (method: PowerCycleMethod) => {
      try {
        console.log(`Initiating power cycle (${method}) for robot ${serialNumber}`);
        
        const res = await fetch(`/api/robots/${serialNumber}/power-cycle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ method })
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Power cycle API error response:', errorText);
          throw new Error(`Server returned ${res.status}: ${errorText}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error('Power cycle request failed:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Power cycle API response:', data);
      setStatus(data.status);
      
      if (data.success) {
        toast({
          title: 'Power cycle initiated',
          description: data.message,
          variant: 'default',
        });
        
        // Schedule status checks
        const checkInterval = setInterval(() => {
          checkStatusMutation.mutate();
        }, 10000); // Check every 10 seconds
        
        // Clear interval after 3 minutes (after expected recovery)
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 3 * 60 * 1000);
      } else {
        toast({
          title: 'Power cycle failed',
          description: data.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      console.error('Power cycle mutation error:', error);
      
      // Set a generic error status
      setStatus((prev) => ({
        ...prev || { inProgress: false, lastAttempt: new Date().toISOString(), success: false },
        error: error.message || 'Failed to send power cycle command to the robot',
        success: false,
      }));
      
      toast({
        title: 'Power cycle failed',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });
  
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log('Checking power cycle status...');
        const res = await fetch(`/api/robots/${serialNumber}/power-cycle-status`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Power cycle status API error:', errorText);
          throw new Error(`Failed to check power cycle status: ${res.status}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error('Error checking power cycle status:', error);
        throw error;
      }
    },
    onSuccess: (data: PowerCycleStatus) => {
      console.log('Power cycle status:', data);
      setStatus(data);
      
      // If the power cycle was in progress but is now complete
      if (status?.inProgress && !data.inProgress) {
        if (data.success) {
          toast({
            title: 'Power cycle completed',
            description: 'The robot has successfully restarted and is now online.',
            variant: 'default',
          });
        } else if (data.recoveryFailed) {
          toast({
            title: 'Power cycle recovery failed',
            description: 'The robot failed to reconnect after the power cycle operation. Manual intervention required.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Power cycle failed',
            description: data.error || 'The robot failed to restart properly.',
            variant: 'destructive',
          });
        }
      }
      
      // If we newly detect a recovery failure
      if (!status?.recoveryFailed && data.recoveryFailed) {
        toast({
          title: 'Critical Error',
          description: 'Robot failed to reconnect after maximum recovery time. Physical inspection required.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      console.error('Failed to check power cycle status:', error);
      // Don't update the status here to avoid overwriting existing status
    }
  });
  
  return {
    powerCycle: (method: PowerCycleMethod = 'restart') => powerCycleMutation.mutate(method),
    checkStatus: () => checkStatusMutation.mutate(),
    status,
    isLoading: powerCycleMutation.isPending,
    isStatusLoading: checkStatusMutation.isPending,
    error: powerCycleMutation.error
  };
}