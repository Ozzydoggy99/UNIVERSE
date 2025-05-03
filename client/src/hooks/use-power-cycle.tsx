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
};

export type PowerCycleMethod = 'restart' | 'shutdown';

export function usePowerCycle(serialNumber: string) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PowerCycleStatus | null>(null);
  
  const powerCycleMutation = useMutation({
    mutationFn: async (method: PowerCycleMethod) => {
      const res = await apiRequest(
        'POST', 
        `/api/robots/${serialNumber}/power-cycle`, 
        { method }
      );
      return await res.json();
    },
    onSuccess: (data) => {
      setStatus(data.status);
      
      if (data.success) {
        toast({
          title: 'Power cycle initiated',
          description: data.message,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Power cycle failed',
          description: data.message,
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Power cycle failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        'GET', 
        `/api/robots/${serialNumber}/power-cycle-status`,
        {}
      );
      return await res.json();
    },
    onSuccess: (data: PowerCycleStatus) => {
      setStatus(data);
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