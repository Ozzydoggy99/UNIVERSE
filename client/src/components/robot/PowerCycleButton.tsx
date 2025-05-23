import React, { useState, useEffect } from 'react';
import { 
  Power, 
  AlertTriangle, 
  Loader2, 
  AlertCircle, 
  RotateCw,
  PowerOff
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePowerCycle, PowerCycleMethod } from '@/hooks/use-power-cycle';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface PowerCycleButtonProps {
  serialNumber: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  buttonText?: string;
  isTestMode?: boolean;
}

export function PowerCycleButton({ 
  serialNumber, 
  variant = 'destructive', 
  className = '', 
  size = 'default',
  buttonText = 'Power Cycle',
  isTestMode = false
}: PowerCycleButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PowerCycleMethod>('restart');
  const [timer, setTimer] = useState<number | null>(null);
  const { toast } = useToast();
  
  const { 
    powerCycle, 
    status, 
    isLoading, 
    checkStatus 
  } = usePowerCycle(serialNumber);
  
  // Periodically check status if a power cycle is in progress
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (status?.inProgress && status?.remainingTime && status.remainingTime > 0) {
      // Set timer for UI
      setTimer(status.remainingTime);
      
      // Update the timer every second
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev === null || prev <= 1) {
            // If timer is up, check status one more time
            checkStatus();
            if (interval) clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Also check status every 5 seconds
      const statusInterval = setInterval(() => {
        checkStatus();
      }, 5000);
      
      return () => {
        if (interval) clearInterval(interval);
        clearInterval(statusInterval);
      };
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status?.inProgress, status?.remainingTime, checkStatus]);
  
  // Handle confirmation
  const handleConfirm = () => {
    powerCycle(selectedMethod);
    // Don't close dialog immediately, wait for response
  };
  
  // Test mode for demo purposes
  const handleTestPowerCycle = async () => {
    try {
      const res = await fetch(`/api/robots/${serialNumber}/test-power-cycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to start test power cycle: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Test power cycle initiated:', data);
      
      toast({
        title: 'Test Power Cycle',
        description: 'Test power cycle initiated. UI will update in real-time.',
        variant: 'default',
      });
      
      // Start checking status
      const checkInterval = setInterval(() => {
        checkStatus();
      }, 2000);
      
      // Clear after 40 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 40 * 1000);
      
    } catch (error) {
      console.error('Error starting test power cycle:', error);
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Failed to start test power cycle',
        variant: 'destructive',
      });
    }
  };
  
  useEffect(() => {
    // Close dialog automatically if power cycle is successful
    if (status?.success && !status?.inProgress) {
      setIsOpen(false);
    }
  }, [status]);
  
  // Format timer display
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <>
      <div className="flex flex-col gap-2">
        <Button 
          variant={variant} 
          className={className}
          size={size}
          onClick={isTestMode ? handleTestPowerCycle : () => setIsOpen(true)}
        >
          <Power className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
        
        {/* Test button for demonstrating the power cycle functionality - only shown in dev environments */}
        {!isTestMode && process.env.NODE_ENV === 'development' && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleTestPowerCycle}
          >
            Test Power Cycle
          </Button>
        )}
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Robot Power Cycle
            </DialogTitle>
            <DialogDescription>
              This will remotely restart or shut down the robot. Use with caution!
            </DialogDescription>
          </DialogHeader>
          
          {status?.inProgress ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center text-center">
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="font-medium">
                    Power cycle in progress...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The robot is {selectedMethod === 'restart' ? 'restarting' : 'shutting down'}.
                    This may take up to {selectedMethod === 'restart' ? '2' : '5'} minutes.
                  </p>
                  
                  {timer !== null && (
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Estimated time remaining:</span>
                        <span className="font-mono">{formatTime(timer)}</span>
                      </div>
                      <Progress 
                        value={status?.recoveryProgress !== undefined 
                          ? status.recoveryProgress 
                          : 100 - (timer / (selectedMethod === 'restart' ? 120 : 300) * 100)} 
                        className="h-2"
                      />
                      
                      {/* Connection status indicator */}
                      <div className="flex justify-between items-center mt-2 text-xs">
                        <div>
                          Robot: {status?.recoveryFailed ? (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                              Failed to Reconnect
                            </Badge>
                          ) : status?.robotConnected ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                              Reconnecting...
                            </Badge>
                          )}
                        </div>
                        <div>
                          Progress: {status?.recoveryProgress !== undefined ? 
                            `${status.recoveryProgress}%` : 
                            `${Math.round(100 - (timer / (selectedMethod === 'restart' ? 120 : 300) * 100))}%`}
                        </div>
                      </div>
                      
                      {/* Recovery failure warning */}
                      {status?.recoveryFailed && (
                        <div className="mt-4 rounded-md bg-red-50 p-3 border border-red-200">
                          <div className="flex">
                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-red-800">Recovery Failed</h4>
                              <p className="text-xs text-red-700 mt-1">
                                The robot could not be contacted after the power cycle operation.
                                Manual intervention may be required to restore the robot.
                              </p>
                              <div className="mt-2">
                                <Button variant="outline" size="sm" className="text-xs h-7 bg-white" onClick={() => setIsOpen(false)}>
                                  Close
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="flex gap-4">
                  <Button
                    variant={selectedMethod === 'restart' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setSelectedMethod('restart')}
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Restart
                  </Button>
                  <Button
                    variant={selectedMethod === 'shutdown' ? 'destructive' : 'outline'}
                    className="flex-1"
                    onClick={() => setSelectedMethod('shutdown')}
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Shutdown
                  </Button>
                </div>
                
                <div className="rounded-md bg-muted p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium">Warning</h3>
                      <div className="text-sm text-muted-foreground mt-2">
                        <p>
                          {selectedMethod === 'restart' ? (
                            <>
                              Restarting the robot will temporarily interrupt all services.
                              The robot will reboot automatically and should be back online in about 2 minutes.
                            </>
                          ) : (
                            <>
                              Shutting down the robot will power it off completely.
                              You will need physical access to turn it back on.
                            </>
                          )}
                        </p>
                        <p className="mt-2">
                          <Badge variant="outline" className="mr-1">Important</Badge>
                          Ensure the robot is not currently performing critical tasks.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {status?.error && (
                  <div className="rounded-md bg-red-50 p-4 border border-red-100">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div className="ml-3 text-red-800">
                        <h3 className="text-sm font-medium">Error</h3>
                        <div className="text-sm mt-1">{status.error}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant={selectedMethod === 'restart' ? 'default' : 'destructive'} 
                  onClick={handleConfirm}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selectedMethod === 'restart' ? 'Restart' : 'Shutdown'} Robot
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}