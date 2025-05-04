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
      console.log(`Executing command on robot ${robotSerial}: ${command}`);
      
      const response = await axios({
        method: 'post',
        url: `/api/robots/${robotSerial}/execute-command`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: { command },
      });
      
      setStatusCode(response.status);
      setIsLoading(false);
      
      // Check the response structure
      if (response.data && response.data.success) {
        console.log('Command executed successfully:', response.data.result);
        return response.data.result || null;
      } else {
        // If the API returns a structured error
        const errorMessage = response.data?.error || response.data?.message || 'Unknown error';
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error('Error executing command:', err);
      setStatusCode(err.response?.status || 500);
      
      // Get the most detailed error message available
      let errorMessage = 'An unknown error occurred';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(new Error(errorMessage));
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