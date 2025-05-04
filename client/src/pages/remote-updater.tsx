import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Info, AlertCircle, ArrowDownCircle, RefreshCw, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRobotApi } from "@/hooks/use-robot-api";
import { Progress } from "@/components/ui/progress";

type UpdateStatus = "idle" | "checking" | "downloading" | "updating" | "restarting" | "error";
type Module = {
  name: string;
  version: string;
  path: string;
  hash: string;
};

type UpdateResponse = {
  status: string;
  data?: {
    update_state: UpdateStatus;
    modules_dir: string;
    modules: Record<string, Module>;
    update_server: string;
  };
  updates?: Array<{
    module: string;
    version: string;
    description?: string;
  }>;
  module?: string;
  version?: string;
  service?: string;
};

export default function RemoteUpdater() {
  const { toast } = useToast();
  const [serialNumber, setSerialNumber] = useState("L382502104987ir");
  const [robotIp, setRobotIp] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [modules, setModules] = useState<Record<string, Module>>({});
  const [availableUpdates, setAvailableUpdates] = useState<Array<{module: string; version: string; description?: string}>>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [modulesDir, setModulesDir] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { executeCommand, getStatusCode } = useRobotApi();

  // Connect to robot WebSocket
  const connectWebSocket = (robotSerialOrIp: string) => {
    let wsUrl: string;
    
    if (robotSerialOrIp.includes('.')) {
      // It's an IP address
      wsUrl = `ws://${robotSerialOrIp}:8090/ws`;
    } else {
      // It's a serial number, use API to get WebSocket URL
      wsUrl = `/api/robots/ws/${robotSerialOrIp}`;
    }
    
    setStatusMessage(`Connecting to robot at ${wsUrl}...`);
    
    try {
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        setWsConnected(true);
        setStatusMessage("WebSocket connection established");
        toast({
          title: "Connected",
          description: "WebSocket connection to robot established",
          variant: "default",
        });
        
        // Subscribe to updater status topic
        newSocket.send(JSON.stringify({
          op: "subscribe",
          topics: ["/updates/status"]
        }));
        
        // Request initial status
        setTimeout(() => {
          sendUpdateCommand("status");
        }, 1000);
      };
      
      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.topic === "/updates/status") {
            handleUpdateStatus(message.data);
          }
        } catch (error) {
          console.error("Error processing WebSocket message", error);
        }
      };
      
      newSocket.onclose = () => {
        setWsConnected(false);
        setStatusMessage("WebSocket connection closed");
        toast({
          title: "Disconnected",
          description: "WebSocket connection to robot closed",
          variant: "destructive",
        });
      };
      
      newSocket.onerror = (error: Event) => {
        console.error("WebSocket error", error);
        setStatusMessage(`WebSocket error occurred`);
        toast({
          title: "Connection Error",
          description: "Failed to connect to robot WebSocket",
          variant: "destructive",
        });
      };
      
      setSocket(newSocket);
      
    } catch (error: any) {
      console.error("Failed to create WebSocket", error);
      setStatusMessage(`Failed to create WebSocket: ${error.message || "Unknown error"}`);
      toast({
        title: "Connection Error",
        description: "Failed to create WebSocket connection",
        variant: "destructive",
      });
    }
  };
  
  // Handle update status messages
  const handleUpdateStatus = (data: UpdateResponse) => {
    console.log("Received update status:", data);
    
    if (data.status === "status" && data.data) {
      setUpdateStatus(data.data.update_state as UpdateStatus);
      setModules(data.data.modules || {});
      setModulesDir(data.data.modules_dir || "");
      setStatusMessage(`Received status update (${data.data.update_state})`);
    } else if (data.status === "updates_available") {
      setAvailableUpdates(data.updates || []);
      setStatusMessage(`Found ${data.updates?.length || 0} available updates`);
      
      if (data.updates && data.updates.length > 0) {
        toast({
          title: "Updates Available",
          description: `Found ${data.updates.length} module updates available`,
          variant: "default",
        });
      } else {
        toast({
          title: "No Updates Available",
          description: "All modules are up to date",
          variant: "default",
        });
      }
    } else if (data.status === "updating") {
      setUpdateStatus("updating");
      setStatusMessage(`Updating module ${data.module} to version ${data.version}`);
    } else if (data.status === "updated") {
      setUpdateStatus("idle");
      setStatusMessage(`Successfully updated ${data.module} to version ${data.version}`);
      toast({
        title: "Update Complete",
        description: `Module ${data.module} updated to version ${data.version}`,
        variant: "default",
      });
      
      // Refresh status
      setTimeout(() => {
        sendUpdateCommand("status");
      }, 1000);
    } else if (data.status === "restarting") {
      setUpdateStatus("restarting");
      setStatusMessage(`Restarting service ${data.service}`);
    } else {
      setStatusMessage(`Received status: ${data.status}`);
    }
  };
  
  // Send update command
  const sendUpdateCommand = (command: string, moduleInfo?: {module: string; version: string}) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Error",
        description: "WebSocket not connected",
        variant: "destructive",
      });
      return;
    }
    
    const message: any = {
      topic: "/updates/command",
      command
    };
    
    if (moduleInfo) {
      message.module = moduleInfo.module;
      message.version = moduleInfo.version;
    }
    
    socket.send(JSON.stringify(message));
    setStatusMessage(`Sent command: ${command}`);
  };
  
  // Check for updates
  const checkForUpdates = () => {
    setUpdateStatus("checking");
    sendUpdateCommand("check_updates");
  };
  
  // Update a specific module
  const updateModule = (module: string, version: string) => {
    setUpdateStatus("downloading");
    sendUpdateCommand("update", { module, version });
  };
  
  // Update all modules
  const updateAllModules = () => {
    setUpdateStatus("downloading");
    sendUpdateCommand("update");
  };
  
  // Install the updater if not already installed
  const installUpdater = async () => {
    setIsInstalling(true);
    setStatusMessage("Installing updater module...");
    
    try {
      // Find robot-ai-single-file-installer.py in the Downloads directory
      const findInstallerCmd = "find /storage/emulated/0/Download -name 'robot-ai-*.py' | sort";
      const findResult = await executeCommand(serialNumber, findInstallerCmd);
      
      if (findResult && findResult.includes("robot-ai")) {
        // Found installer
        const installerPath = findResult.split("\n")[0].trim();
        setStatusMessage(`Found installer at ${installerPath}`);
        
        // Execute the installer
        const executeInstallerCmd = `python ${installerPath}`;
        setStatusMessage(`Executing installer: ${executeInstallerCmd}`);
        
        const installResult = await executeCommand(serialNumber, executeInstallerCmd);
        
        if (installResult) {
          setStatusMessage("Installer executed successfully");
          toast({
            title: "Installation Started",
            description: "Robot AI installer started. This may take a few minutes.",
            variant: "default",
          });
          
          // Wait a moment then try to connect to websocket
          setTimeout(() => {
            connectWebSocket(serialNumber);
          }, 10000);
        } else {
          setStatusMessage("Failed to execute installer");
          toast({
            title: "Installation Failed",
            description: "Failed to execute installer",
            variant: "destructive",
          });
        }
      } else {
        setStatusMessage("Installer not found in Downloads directory");
        toast({
          title: "Installer Not Found",
          description: "Robot AI installer not found in Downloads directory",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Installation error", error);
      setStatusMessage(`Installation error: ${error.message || 'Unknown error'}`);
      toast({
        title: "Installation Error",
        description: error.message || 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };
  
  // Restart service
  const restartService = () => {
    setUpdateStatus("restarting");
    sendUpdateCommand("restart", { module: "robot-ai", version: "current" });
  };
  
  // Disconnect WebSocket
  const disconnect = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);
  
  // Get update status label and color
  const getStatusDetails = (status: UpdateStatus) => {
    switch (status) {
      case "idle":
        return { icon: <Info className="h-4 w-4" />, color: "bg-gray-400", label: "Idle" };
      case "checking":
        return { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "bg-blue-400", label: "Checking for Updates" };
      case "downloading":
        return { icon: <ArrowDownCircle className="h-4 w-4" />, color: "bg-blue-600", label: "Downloading" };
      case "updating":
        return { icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: "bg-yellow-500", label: "Installing Update" };
      case "restarting":
        return { icon: <Play className="h-4 w-4" />, color: "bg-purple-500", label: "Restarting Service" };
      case "error":
        return { icon: <AlertCircle className="h-4 w-4" />, color: "bg-red-500", label: "Error" };
      default:
        return { icon: <Info className="h-4 w-4" />, color: "bg-gray-400", label: "Unknown" };
    }
  };
  
  const statusDetails = getStatusDetails(updateStatus);
  
  return (
    <div className="container py-10">
      <h1 className="text-4xl font-bold mb-6">Remote AI Updater</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Manage and update Robot AI modules remotely without physical access to robots
      </p>
      
      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Connect to Robot</CardTitle>
              <CardDescription>
                Enter robot details to establish connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serial">Robot Serial Number</Label>
                  <Input 
                    id="serial" 
                    placeholder="e.g. L382502104987ir" 
                    value={serialNumber} 
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ip">or Robot IP Address (optional)</Label>
                  <Input 
                    id="ip" 
                    placeholder="e.g. 192.168.25.25" 
                    value={robotIp} 
                    onChange={(e) => setRobotIp(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="flex gap-2 w-full">
                <Button 
                  className="flex-1" 
                  onClick={() => connectWebSocket(robotIp || serialNumber)}
                  disabled={wsConnected || (!serialNumber && !robotIp)}
                >
                  Connect
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  onClick={disconnect}
                  disabled={!wsConnected}
                >
                  Disconnect
                </Button>
              </div>
              
              <Button 
                className="w-full" 
                variant="secondary" 
                onClick={installUpdater}
                disabled={isInstalling || !serialNumber}
              >
                {isInstalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Install Updater
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
              <div className="flex items-center space-x-2">
                <span className={`h-3 w-3 rounded-full ${statusDetails.color}`}></span>
                <span className="flex items-center">
                  {statusDetails.icon}
                  <span className="ml-1">{statusDetails.label}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Module Directory</p>
                  <p className="text-sm text-muted-foreground break-all font-mono">
                    {modulesDir || "Unknown"}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">Status Message</p>
                  <p className="text-sm text-muted-foreground">
                    {statusMessage || "No status available"}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-1">WebSocket Connection</p>
                  <div className="flex items-center">
                    <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                    <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex gap-2 w-full">
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  onClick={() => sendUpdateCommand("status")}
                  disabled={!wsConnected}
                >
                  Refresh Status
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  onClick={restartService}
                  disabled={!wsConnected}
                >
                  Restart Service
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          <Tabs defaultValue="modules">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="modules">Installed Modules</TabsTrigger>
              <TabsTrigger value="updates">Available Updates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="modules">
              <Card>
                <CardHeader>
                  <CardTitle>Installed Robot AI Modules</CardTitle>
                  <CardDescription>
                    View and manage modules currently installed on the robot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(modules).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No modules information available</p>
                      <p className="text-sm mt-2">
                        Connect to the robot and refresh status to see installed modules
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(modules).map(([moduleName, moduleInfo]) => (
                        <div key={moduleName} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{moduleName}</h3>
                            <Badge variant="outline">v{moduleInfo.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono break-all">
                            {moduleInfo.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={checkForUpdates}
                    disabled={!wsConnected}
                  >
                    Check for Updates
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="updates">
              <Card>
                <CardHeader>
                  <CardTitle>Available Updates</CardTitle>
                  <CardDescription>
                    Update modules to their latest versions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {availableUpdates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p>All modules are up to date</p>
                      <p className="text-sm mt-2">
                        Check for updates to see if new versions are available
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableUpdates.map((update) => (
                        <div key={update.module} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{update.module}</h3>
                            <Badge>v{update.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            {update.description || "Update available for this module"}
                          </p>
                          <Button 
                            size="sm" 
                            onClick={() => updateModule(update.module, update.version)}
                            disabled={!wsConnected || updateStatus !== "idle"}
                          >
                            Update
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={checkForUpdates}
                    disabled={!wsConnected}
                  >
                    Refresh
                  </Button>
                  
                  {availableUpdates.length > 0 && (
                    <Button 
                      onClick={updateAllModules}
                      disabled={!wsConnected || updateStatus !== "idle"}
                    >
                      Update All
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
          
          {updateStatus !== "idle" && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Update in Progress</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="mb-2">{statusMessage}</div>
                <Progress value={
                  updateStatus === "checking" ? 30 :
                  updateStatus === "downloading" ? 50 :
                  updateStatus === "updating" ? 70 :
                  updateStatus === "restarting" ? 90 : 100
                } className="h-2" />
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}