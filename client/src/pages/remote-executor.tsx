import { useState, useEffect } from 'react';
import { useRobotApi } from '@/hooks/use-robot-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Terminal } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';

export default function RemoteExecutor() {
  const [command, setCommand] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [robotConnected, setRobotConnected] = useState<boolean>(false);
  const { executeCommand, isLoading, error } = useRobotApi();

  // Check robot connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Instead of executing a command, check robot status directly
        const response = await fetch(`/api/robots/status/${PHYSICAL_ROBOT_SERIAL}`);
        const data = await response.json();
        
        // If we get a response, the robot is connected
        setRobotConnected(response.ok && data.connectionStatus === 'connected');
      } catch (err) {
        console.error('Robot connection check failed:', err);
        setRobotConnected(false);
      }
    };
    
    checkConnection();
    // Set up a periodic check every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Reset status when command changes
  useEffect(() => {
    setStatus('idle');
  }, [command]);

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;

    try {
      // Check if robot is connected before sending command
      if (!robotConnected) {
        setResult("Error: Robot is not connected. Please check the robot's power and network connection.");
        setStatus('error');
        return;
      }
      
      const response = await executeCommand(PHYSICAL_ROBOT_SERIAL, command);
      
      setResult(response);
      setStatus(response ? 'success' : 'error');
    } catch (err) {
      setStatus('error');
      console.error('Error executing command:', err);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-6 w-6" />
            <CardTitle>Remote Command Execution</CardTitle>
          </div>
          <CardDescription>
            Execute shell commands on the robot. Use with caution.
          </CardDescription>
          <div className="flex items-center mt-2 gap-2">
            <div className={`w-3 h-3 rounded-full ${robotConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-muted-foreground">
              {robotConnected ? 'Robot is connected' : 'Robot is not connected'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="command" className="text-sm font-medium">
                Command
              </label>
              <div className="flex gap-2">
                <Input
                  id="command"
                  placeholder="Enter a shell command (e.g., ls -la)"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleExecuteCommand} 
                  disabled={isLoading || !command.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    'Execute'
                  )}
                </Button>
              </div>
            </div>

            {status !== 'idle' && (
              <Alert variant={status === 'success' ? "default" : "destructive"}>
                {status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {status === 'success' 
                    ? 'Command executed successfully' 
                    : 'Command execution failed'}
                </AlertTitle>
                <AlertDescription>
                  {status === 'success' 
                    ? 'The command was executed on the robot.' 
                    : error?.message || 'An error occurred while executing the command.'}
                </AlertDescription>
              </Alert>
            )}

            {result !== null && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Result</label>
                <Textarea
                  value={result}
                  readOnly
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${robotConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="text-sm text-muted-foreground">
              {robotConnected ? 'Connected to robot: ' : 'Not connected to robot: '} 
              {PHYSICAL_ROBOT_SERIAL}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}