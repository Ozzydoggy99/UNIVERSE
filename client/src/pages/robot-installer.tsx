import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function RobotInstaller() {
  const { toast } = useToast();
  const [robotIp, setRobotIp] = useState("192.168.25.25");
  const [robotSn, setRobotSn] = useState("L382502104987ir");
  const [installing, setInstalling] = useState(false);
  const [complete, setComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const steps = [
    "Checking connection",
    "Downloading Robot AI",
    "Installing components",
    "Starting services"
  ];

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const simulateInstallation = async () => {
    setInstalling(true);
    setProgress(5);
    
    // Step 1: Check connection
    setCurrentStep(0);
    addLog(`Checking connection to robot at ${robotIp}...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    addLog(`Successfully connected to robot ${robotSn}`);
    setProgress(25);
    
    // Step 2: Download Robot AI
    setCurrentStep(1);
    addLog("Downloading Robot AI package...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    addLog("Robot AI package downloaded successfully");
    setProgress(50);
    
    // Step 3: Install components
    setCurrentStep(2);
    addLog(`Installing Robot AI components for robot ${robotSn}...`);
    await new Promise(resolve => setTimeout(resolve, 4000));
    addLog("Robot AI components installed successfully");
    setProgress(75);
    
    // Step 4: Start services
    setCurrentStep(3);
    addLog("Starting Robot AI services...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    addLog("Robot AI services started successfully");
    setProgress(100);
    
    // Complete
    setInstalling(false);
    setComplete(true);
    
    toast({
      title: "Installation Complete",
      description: "Robot AI has been successfully installed on your robot",
    });
  };

  const handleInstall = () => {
    if (!robotIp) {
      toast({
        title: "Missing Information",
        description: "Please enter the robot IP address",
        variant: "destructive",
      });
      return;
    }
    
    if (!robotSn) {
      toast({
        title: "Missing Information",
        description: "Please enter the robot serial number",
        variant: "destructive",
      });
      return;
    }
    
    simulateInstallation();
  };

  return (
    <div className="container mx-auto py-10 max-w-3xl">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Robot AI Installer</CardTitle>
          <CardDescription>
            Install the enhanced AI package on your robot for improved navigation and control
          </CardDescription>
        </CardHeader>
        
        {!installing && !complete ? (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="robot-ip">Robot IP Address</Label>
              <Input 
                id="robot-ip" 
                value={robotIp} 
                onChange={(e) => setRobotIp(e.target.value)} 
                placeholder="e.g., 192.168.25.25" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="robot-sn">Robot Serial Number</Label>
              <Input 
                id="robot-sn" 
                value={robotSn} 
                onChange={(e) => setRobotSn(e.target.value)} 
                placeholder="e.g., L382502104987ir" 
              />
            </div>
          </CardContent>
        ) : null}
        
        {installing && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Installation Progress</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="space-y-4 mt-4">
              {steps.map((step, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-md border ${
                    index === currentStep 
                      ? "bg-primary/10 border-primary" 
                      : index < currentStep 
                        ? "bg-green-50 border-green-200" 
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                      index === currentStep 
                        ? "bg-primary text-white" 
                        : index < currentStep 
                          ? "bg-green-500 text-white" 
                          : "bg-gray-200 text-gray-500"
                    }`}>
                      {index < currentStep ? "✓" : index + 1}
                    </div>
                    <span className="font-medium">{step}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <Label>Installation Log</Label>
              <div className="mt-1 bg-black rounded-md p-4 h-48 overflow-y-auto">
                <pre className="text-xs text-white font-mono">
                  {logs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </pre>
              </div>
            </div>
          </CardContent>
        )}
        
        {complete && (
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Installation Complete!</span>
              </div>
              <p className="mt-2">
                Robot AI has been successfully installed on robot {robotSn}.
              </p>
            </div>
            
            <div className="mt-4">
              <p className="text-center">You can now access the Robot AI dashboard at:</p>
              <p className="text-center font-bold text-lg mt-2">
                <a href={`http://${robotIp}:8080`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  http://{robotIp}:8080
                </a>
              </p>
            </div>
            
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="font-medium mb-2">Installation Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Robot IP:</div>
                <div>{robotIp}</div>
                <div className="text-gray-500">Robot S/N:</div>
                <div>{robotSn}</div>
                <div className="text-gray-500">Status:</div>
                <div>Installed and Running</div>
              </div>
            </div>
          </CardContent>
        )}
        
        <CardFooter className="flex justify-between">
          {!installing && !complete ? (
            <Button onClick={handleInstall} className="w-full">Install Robot AI</Button>
          ) : complete ? (
            <Button onClick={() => window.open(`http://${robotIp}:8080`, '_blank')} className="w-full">
              Go to Robot AI Dashboard
            </Button>
          ) : (
            <Button disabled className="w-full">Installing... ({progress}%)</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}