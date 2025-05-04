import { useState, useCallback } from 'react';
import axios from 'axios';

interface UseRobotApiReturn {
  executeCommand: (robotSerial: string, command: string) => Promise<string | null>;
  getStatusCode: () => number | null;
  isLoading: boolean;
  error: Error | null;
}

export function useRobotApi(): UseRobotApiReturn {
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const executeCommand = useCallback(async (robotSerial: string, command: string): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios({
        method: 'post',
        url: `/api/robots/command/${robotSerial}`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: { command },
      });
      
      setStatusCode(response.status);
      setIsLoading(false);
      return response.data.output || null;
    } catch (err: any) {
      setStatusCode(err.response?.status || 500);
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      setIsLoading(false);
      return null;
    }
  }, []);

  const getStatusCode = useCallback((): number | null => {
    return statusCode;
  }, [statusCode]);

  return {
    executeCommand,
    getStatusCode,
    isLoading,
    error,
  };
}