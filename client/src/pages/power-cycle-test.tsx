import React from 'react';
import { PowerCycleButton } from '@/components/robot/PowerCycleButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PHYSICAL_ROBOT_SERIAL } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, AlertCircle, Info, Power } from 'lucide-react';
import { useLocation } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PowerCycleTestPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const serialNumber = PHYSICAL_ROBOT_SERIAL;

  const handleDirectApiCall = async () => {
    try {
      const res = await fetch(`/api/robots/${serialNumber}/test-power-cycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      toast({
        title: "Test Started",
        description: "Power cycle test has started. The robot will simulate a restart.",
        variant: "default",
      });
      
      console.log('Test power cycle response:', data);
    } catch (error) {
      console.error('Error calling test API:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to start power cycle test",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/robot-details')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Robot Details
        </Button>
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Power Cycle Functionality Test</h1>
      
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Test Environment</AlertTitle>
        <AlertDescription>
          This page allows you to test the power cycle functionality in a safe environment.
          No actual robot restarts will be performed - this is just a simulation for testing the UI.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5 text-primary" />
              Standard Test
            </CardTitle>
            <CardDescription>
              Test the normal power cycle flow where the robot successfully restarts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground mb-4">
                This test simulates a successful power cycle where the robot restarts and reconnects properly.
              </p>
              
              <PowerCycleButton 
                serialNumber={serialNumber}
                variant="outline"
                buttonText="Test Normal Restart"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Recovery Failure Test
            </CardTitle>
            <CardDescription>
              Test what happens when the robot fails to reconnect after restarting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground mb-4">
                This test simulates a scenario where the robot shuts down but doesn't successfully reconnect,
                triggering the recovery failure detection after maximum timeout.
              </p>
              
              <Button 
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/robots/${serialNumber}/test-power-cycle`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ simulateFailure: true })
                    });
                    
                    if (!res.ok) {
                      throw new Error(`Failed to start test: ${res.status}`);
                    }
                    
                    toast({
                      title: "Recovery Failure Test",
                      description: "Simulating a power cycle where the robot fails to reconnect.",
                      variant: "default",
                    });
                  } catch (error) {
                    toast({
                      title: "Test Error",
                      description: error instanceof Error ? error.message : "Failed to run test",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                className="border-amber-200 hover:bg-amber-50"
              >
                Test Recovery Failure
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-start">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                This will simulate the case where the robot's system has shut down but fails to 
                restart or reconnect to the network, requiring manual intervention.
              </p>
            </div>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              Direct API Call
            </CardTitle>
            <CardDescription>
              Call the test API endpoint directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground mb-4">
                This triggers the test power cycle API directly without the dialog UI.
                Monitor the console for detailed logs.
              </p>
              
              <Button onClick={handleDirectApiCall} variant="outline">
                Call Test API Directly
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-start">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                After triggering, check the console for detailed logs and navigate to
                the Robot Details page to see the status indicator.
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Implementation Details</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            The power cycle implementation includes multiple fallback endpoints in case the primary
            restart method fails. It tries up to 13 different API endpoints to ensure the robot
            can be restarted even if some services are unavailable.
          </p>
          <p>
            The system tracks the robot's connection status and shows a real-time recovery progress
            percentage during restart. It also includes automatic service recovery for critical
            services like the LiDAR.
          </p>
          <p>
            The enhanced power cycle functionality now includes recovery failure detection. If the robot
            fails to reconnect within 5 minutes after a restart, the system will mark the recovery as failed
            and alert administrators that manual intervention is needed.
          </p>
          <p>
            For safety, the system enforces a 5-minute cooldown period between power cycle attempts
            to prevent damage to the robot's hardware from rapid cycling.
          </p>
        </div>
      </div>
    </div>
  );
}