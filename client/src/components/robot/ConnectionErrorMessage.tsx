import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRobot } from '@/providers/robot-provider';

export function ConnectionErrorMessage() {
  const { connectionState, refreshData } = useRobot();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Only render if we're in the error state
  if (connectionState !== 'error') {
    return null;
  }
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing robot connection:', error);
    } finally {
      // Add a brief delay to show the refreshing state
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  };
  
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="flex justify-between items-center mt-2">
        <span>
          There was a problem connecting to the robot. Please check your connection and try again.
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-4"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Reconnecting...' : 'Reconnect'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export default ConnectionErrorMessage;