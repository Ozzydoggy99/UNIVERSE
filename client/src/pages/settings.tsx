import { useState } from "react";
import { ConnectionStatus } from "@/components/status/connection-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function Settings() {
  const { apiEndpoint, setShowAuthDialog } = useAuth();
  const { toast } = useToast();
  
  // API Settings
  const [refreshInterval, setRefreshInterval] = useState("10");
  
  // Notification Settings
  const [notifyLowBattery, setNotifyLowBattery] = useState(true);
  const [notifyErrors, setNotifyErrors] = useState(true);
  const [notifyTaskCompletion, setNotifyTaskCompletion] = useState(true);
  const [notifyObstacles, setNotifyObstacles] = useState(true);
  const [batteryThreshold, setBatteryThreshold] = useState(20);
  
  // Robot Settings
  const [defaultSpeed, setDefaultSpeed] = useState(50);
  const [operationMode, setOperationMode] = useState("manual");
  const [safetyDistance, setSafetyDistance] = useState(1);
  
  // Display Settings
  const [showGrid, setShowGrid] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const [mapRefreshRate, setMapRefreshRate] = useState("5");
  
  const handleSaveSettings = (section: string) => {
    // In a real app, this would call the API to save the settings
    toast({
      title: "Settings Saved",
      description: `${section} settings have been updated`,
    });
  };
  
  return (
    <>
      <ConnectionStatus />
      
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="api">
            <TabsList className="mb-4">
              <TabsTrigger value="api">API Connection</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="robot">Robot Configuration</TabsTrigger>
              <TabsTrigger value="display">Display Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="api">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">API Connection Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="api-endpoint">API Endpoint</Label>
                      <div className="flex items-center mt-1">
                        <Input 
                          id="api-endpoint" 
                          value={apiEndpoint || "Not Connected"} 
                          disabled 
                        />
                        <Button 
                          className="ml-2" 
                          onClick={() => setShowAuthDialog(true)}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="refresh-interval">Data Refresh Interval (seconds)</Label>
                      <Select 
                        value={refreshInterval} 
                        onValueChange={setRefreshInterval}
                      >
                        <SelectTrigger id="refresh-interval" className="mt-1">
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">1 minute</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Connection Options</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="auto-connect">Auto-connect on startup</Label>
                      <Switch id="auto-connect" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="secure-connection">Use secure connection (HTTPS)</Label>
                      <Switch id="secure-connection" defaultChecked />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="connection-timeout">Enable connection timeout</Label>
                      <Switch id="connection-timeout" defaultChecked />
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => handleSaveSettings("API Connection")} className="mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Save API Settings
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="notifications">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="notify-low-battery">Low Battery Alerts</Label>
                      <Switch 
                        id="notify-low-battery" 
                        checked={notifyLowBattery}
                        onCheckedChange={setNotifyLowBattery}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="notify-errors">Error Notifications</Label>
                      <Switch 
                        id="notify-errors" 
                        checked={notifyErrors}
                        onCheckedChange={setNotifyErrors}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="notify-task-completion">Task Completion Notifications</Label>
                      <Switch 
                        id="notify-task-completion" 
                        checked={notifyTaskCompletion}
                        onCheckedChange={setNotifyTaskCompletion}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="notify-obstacles">Obstacle Detection Alerts</Label>
                      <Switch 
                        id="notify-obstacles" 
                        checked={notifyObstacles}
                        onCheckedChange={setNotifyObstacles}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Alert Thresholds</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label htmlFor="battery-threshold">Low Battery Threshold ({batteryThreshold}%)</Label>
                      </div>
                      <Slider
                        id="battery-threshold"
                        value={[batteryThreshold]}
                        onValueChange={(values) => setBatteryThreshold(values[0])}
                        min={5}
                        max={50}
                        step={5}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>5%</span>
                        <span>50%</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => handleSaveSettings("Notification")} className="mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="robot">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Operation Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="operation-mode">Default Operation Mode</Label>
                      <Select 
                        value={operationMode} 
                        onValueChange={setOperationMode}
                      >
                        <SelectTrigger id="operation-mode" className="mt-1">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual Control</SelectItem>
                          <SelectItem value="autonomous">Autonomous</SelectItem>
                          <SelectItem value="assisted">Assisted Control</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label htmlFor="default-speed">Default Movement Speed ({defaultSpeed}%)</Label>
                      </div>
                      <Slider
                        id="default-speed"
                        value={[defaultSpeed]}
                        onValueChange={(values) => setDefaultSpeed(values[0])}
                        min={10}
                        max={100}
                        step={5}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Slow</span>
                        <span>Fast</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Safety Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label htmlFor="safety-distance">Safety Distance ({safetyDistance}m)</Label>
                      </div>
                      <Slider
                        id="safety-distance"
                        value={[safetyDistance]}
                        onValueChange={(values) => setSafetyDistance(values[0])}
                        min={0.5}
                        max={3}
                        step={0.1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0.5m</span>
                        <span>3m</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="collision-detection">Collision Detection</Label>
                        <Switch id="collision-detection" defaultChecked />
                      </div>
                      <div className="flex justify-between items-center">
                        <Label htmlFor="auto-emergency-stop">Auto Emergency Stop</Label>
                        <Switch id="auto-emergency-stop" defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => handleSaveSettings("Robot Configuration")} className="mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Save Robot Settings
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="display">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Map Display Settings</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="show-grid">Show Grid Lines</Label>
                        <Switch 
                          id="show-grid" 
                          checked={showGrid}
                          onCheckedChange={setShowGrid}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <Label htmlFor="show-path">Show Robot Path</Label>
                        <Switch 
                          id="show-path" 
                          checked={showPath}
                          onCheckedChange={setShowPath}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <Label htmlFor="show-obstacles">Show Obstacles</Label>
                        <Switch 
                          id="show-obstacles" 
                          checked={showObstacles}
                          onCheckedChange={setShowObstacles}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="map-refresh-rate">Map Refresh Rate (seconds)</Label>
                      <Select 
                        value={mapRefreshRate} 
                        onValueChange={setMapRefreshRate}
                      >
                        <SelectTrigger id="map-refresh-rate" className="mt-1">
                          <SelectValue placeholder="Select refresh rate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 second</SelectItem>
                          <SelectItem value="5">5 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Interface Settings</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="dark-mode">Dark Mode</Label>
                      <Switch id="dark-mode" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="compact-view">Compact View</Label>
                      <Switch id="compact-view" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="enable-animations">Enable Animations</Label>
                      <Switch id="enable-animations" defaultChecked />
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => handleSaveSettings("Display")} className="mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Save Display Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
