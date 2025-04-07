import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayIcon, PanelTopDashed, PauseIcon, HomeIcon, SettingsIcon, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from "lucide-react";
import { startRobot, stopRobot, pauseRobot, homeRobot, calibrateRobot, moveRobot, stopMovement, setSpeed, sendCustomCommand } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface RobotControlsProps {
  className?: string;
}

export function RobotControls({ className }: RobotControlsProps) {
  const [speedSetting, setSpeedSetting] = useState(50);
  const [customCommand, setCustomCommand] = useState("");
  const [movementActive, setMovementActive] = useState<string | null>(null);
  const { toast } = useToast();

  // Clear movement when component unmounts
  useEffect(() => {
    return () => {
      if (movementActive) {
        handleStopMovement();
      }
    };
  }, [movementActive]);

  const handleStartRobot = async () => {
    try {
      await startRobot();
      toast({
        title: "Robot Started",
        description: "Robot has been successfully started",
      });
    } catch (error) {
      toast({
        title: "Error Starting Robot",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleStopRobot = async () => {
    try {
      await stopRobot();
      toast({
        title: "Emergency Stop Activated",
        description: "Robot has been stopped",
      });
    } catch (error) {
      toast({
        title: "Error Stopping Robot",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handlePauseRobot = async () => {
    try {
      await pauseRobot();
      toast({
        title: "Robot Paused",
        description: "Robot operations have been paused",
      });
    } catch (error) {
      toast({
        title: "Error Pausing Robot",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleHomeRobot = async () => {
    try {
      await homeRobot();
      toast({
        title: "Returning Home",
        description: "Robot is returning to home position",
      });
    } catch (error) {
      toast({
        title: "Error Returning Home",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCalibrateRobot = async () => {
    try {
      await calibrateRobot();
      toast({
        title: "Calibration Started",
        description: "Robot calibration procedure has been initiated",
      });
    } catch (error) {
      toast({
        title: "Error Calibrating Robot",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleMoveStart = async (direction: 'forward' | 'backward' | 'left' | 'right') => {
    try {
      setMovementActive(direction);
      await moveRobot(direction, speedSetting);
    } catch (error) {
      toast({
        title: "Movement Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setMovementActive(null);
    }
  };

  const handleStopMovement = async () => {
    try {
      await stopMovement();
      setMovementActive(null);
    } catch (error) {
      toast({
        title: "Error Stopping Movement",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSpeedChange = async (value: number[]) => {
    const newSpeed = value[0];
    setSpeedSetting(newSpeed);
    try {
      await setSpeed(newSpeed);
    } catch (error) {
      toast({
        title: "Error Setting Speed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSendCommand = async () => {
    if (!customCommand.trim()) {
      toast({
        title: "Empty Command",
        description: "Please enter a command",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendCustomCommand(customCommand);
      toast({
        title: "Command Sent",
        description: `Command "${customCommand}" has been sent successfully`,
      });
      setCustomCommand("");
    } catch (error) {
      toast({
        title: "Error Sending Command",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Robot Control</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Basic Control Buttons */}
        <div className="mb-6">
          <h3 className="text-muted-foreground mb-2 font-medium">Basic Controls</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="default" 
              onClick={handleStartRobot}
              className="control-button"
            >
              <PlayIcon className="mr-1 h-4 w-4" />
              Start
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleStopRobot}
              className="control-button"
            >
              <PanelTopDashed className="mr-1 h-4 w-4" />
              Stop
            </Button>
            <Button 
              variant="secondary" 
              onClick={handlePauseRobot}
              className="control-button"
            >
              <PauseIcon className="mr-1 h-4 w-4" />
              Pause
            </Button>
            <Button 
              variant="outline" 
              onClick={handleHomeRobot}
              className="control-button"
            >
              <HomeIcon className="mr-1 h-4 w-4" />
              Home
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCalibrateRobot}
              className="control-button"
            >
              <SettingsIcon className="mr-1 h-4 w-4" />
              Calibrate
            </Button>
          </div>
        </div>
        
        {/* Movement Controls */}
        <div className="mb-6">
          <h3 className="text-muted-foreground mb-2 font-medium">Movement Controls</h3>
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            <div></div>
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 control-button ${movementActive === 'forward' ? 'bg-primary text-primary-foreground' : ''}`}
              onMouseDown={() => handleMoveStart('forward')}
              onMouseUp={handleStopMovement}
              onMouseLeave={() => movementActive === 'forward' && handleStopMovement()}
              onTouchStart={() => handleMoveStart('forward')}
              onTouchEnd={handleStopMovement}
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
            <div></div>
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 control-button ${movementActive === 'left' ? 'bg-primary text-primary-foreground' : ''}`}
              onMouseDown={() => handleMoveStart('left')}
              onMouseUp={handleStopMovement}
              onMouseLeave={() => movementActive === 'left' && handleStopMovement()}
              onTouchStart={() => handleMoveStart('left')}
              onTouchEnd={handleStopMovement}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 control-button"
              onClick={handleStopMovement}
            >
              <X className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 control-button ${movementActive === 'right' ? 'bg-primary text-primary-foreground' : ''}`}
              onMouseDown={() => handleMoveStart('right')}
              onMouseUp={handleStopMovement}
              onMouseLeave={() => movementActive === 'right' && handleStopMovement()}
              onTouchStart={() => handleMoveStart('right')}
              onTouchEnd={handleStopMovement}
            >
              <ArrowRight className="h-6 w-6" />
            </Button>
            <div></div>
            <Button
              variant="outline"
              size="icon"
              className={`h-12 w-12 control-button ${movementActive === 'backward' ? 'bg-primary text-primary-foreground' : ''}`}
              onMouseDown={() => handleMoveStart('backward')}
              onMouseUp={handleStopMovement}
              onMouseLeave={() => movementActive === 'backward' && handleStopMovement()}
              onTouchStart={() => handleMoveStart('backward')}
              onTouchEnd={handleStopMovement}
            >
              <ArrowDown className="h-6 w-6" />
            </Button>
            <div></div>
          </div>
        </div>
        
        {/* Speed Control */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-muted-foreground font-medium">Movement Speed</h3>
            <span className="text-sm font-medium">{speedSetting}%</span>
          </div>
          <Slider
            value={[speedSetting]}
            onValueChange={handleSpeedChange}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
        
        {/* Custom Commands */}
        <div>
          <h3 className="text-muted-foreground mb-2 font-medium">Custom Command</h3>
          <div className="flex">
            <Input
              type="text"
              placeholder="Enter command"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              className="flex-1 rounded-r-none"
            />
            <Button
              className="rounded-l-none control-button"
              onClick={handleSendCommand}
            >
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
