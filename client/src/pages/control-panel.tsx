import { ConnectionStatus } from "@/components/status/connection-status";
import { RobotControls } from "@/components/ui/robot-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRobot } from "@/providers/robot-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function ControlPanel() {
  const { toast } = useToast();
  const { robotStatus } = useRobot();
  const [autoMode, setAutoMode] = useState(false);
  
  // These could be connected to API calls in a real implementation
  const [rotationSpeed, setRotationSpeed] = useState(50);
  const [liftHeight, setLiftHeight] = useState(0);
  const [gripperWidth, setGripperWidth] = useState(50);
  
  const handleAutoModeToggle = (checked: boolean) => {
    setAutoMode(checked);
    toast({
      title: checked ? "Auto Mode Enabled" : "Auto Mode Disabled",
      description: checked 
        ? "Robot will now operate autonomously" 
        : "Robot is now in manual control mode",
    });
  };

  return (
    <>
      <ConnectionStatus />
      
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <RobotControls className="mb-4" />
          
          <Card>
            <CardHeader>
              <CardTitle>Advanced Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Mode Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Autonomous Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable robot to operate without manual control
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="auto-mode">
                    {autoMode ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch 
                    id="auto-mode" 
                    checked={autoMode} 
                    onCheckedChange={handleAutoModeToggle} 
                  />
                </div>
              </div>
              
              {/* Rotation Speed */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="rotation-speed">Rotation Speed</Label>
                  <span className="text-sm">{rotationSpeed}%</span>
                </div>
                <Slider
                  id="rotation-speed"
                  value={[rotationSpeed]}
                  onValueChange={values => setRotationSpeed(values[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              {/* Lift Height */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="lift-height">Lift Height</Label>
                  <span className="text-sm">{liftHeight} cm</span>
                </div>
                <Slider
                  id="lift-height"
                  value={[liftHeight]}
                  onValueChange={values => setLiftHeight(values[0])}
                  min={0}
                  max={30}
                  step={1}
                />
              </div>
              
              {/* Gripper Width */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="gripper-width">Gripper Width</Label>
                  <span className="text-sm">{gripperWidth} mm</span>
                </div>
                <Slider
                  id="gripper-width"
                  value={[gripperWidth]}
                  onValueChange={values => setGripperWidth(values[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">Save Preset</Button>
                <Button variant="outline">Load Preset</Button>
                <Button variant="default">Execute Sequence</Button>
                <Button variant="destructive">Emergency Override</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Robot Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold">
                      {robotStatus?.battery || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Battery</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold">
                      {robotStatus?.uptime || "0h 0m"}
                    </div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Current Operation</h3>
                  <p>{robotStatus?.operationalStatus || "Idle"}</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">System Messages</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <div className="text-sm p-2 bg-muted rounded-md">
                      <span className="text-muted-foreground">[{new Date().toLocaleTimeString()}]</span> System online and ready
                    </div>
                    {robotStatus?.messages?.map((message, i) => (
                      <div key={i} className="text-sm p-2 bg-muted rounded-md">
                        <span className="text-muted-foreground">[{message.timestamp}]</span> {message.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
