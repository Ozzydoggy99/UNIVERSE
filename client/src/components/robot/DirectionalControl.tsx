import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, StopCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DirectionalControlProps {
  serialNumber: string;
  disabled?: boolean;
}

export function DirectionalControl({ serialNumber, disabled = false }: DirectionalControlProps) {
  const [speed, setSpeed] = useState<number>(0.5); // Value from 0.1 to 1.0
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [robotParams, setRobotParams] = useState<any>({
    maxForwardVel: 0.8,
    maxBackwardVel: -0.2,
    maxAngularVel: 0.78,
    accSmoothLevel: 'normal',
    autoHold: true,
    bumpTolerance: 0.5
  });
  const [robotParamsLoaded, setRobotParamsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Fetch robot parameters on component mount
  useEffect(() => {
    const fetchRobotParams = async () => {
      try {
        if (!serialNumber) return;
        
        // Get robot parameters from the backend
        const response = await fetch(`/api/robots/params/${serialNumber}`);
        if (!response.ok) {
          console.warn('Could not fetch robot parameters, using defaults');
          return;
        }
        
        const params = await response.json();
        
        // Store relevant parameters in state
        setRobotParams({
          maxForwardVel: params['/wheel_control/max_forward_velocity'] || 0.8,
          maxBackwardVel: params['/wheel_control/max_backward_velocity'] || -0.2,
          maxAngularVel: params['/wheel_control/max_angular_velocity'] || 0.78,
          accSmoothLevel: params['/wheel_control/acc_smoother/smooth_level'] || 'normal',
          autoHold: params['/planning/auto_hold'] !== undefined ? params['/planning/auto_hold'] : true,
          bumpTolerance: params['/control/bump_tolerance'] || 0.5
        });
        
        setRobotParamsLoaded(true);
        console.log('Robot parameters loaded:', params);
      } catch (error) {
        console.error('Error fetching robot parameters:', error);
        setErrorMessage('Could not load robot configuration. Using default parameters.');
      }
    };
    
    fetchRobotParams();
  }, [serialNumber]);
  
  const handleDirectionClick = async (direction: 'forward' | 'backward' | 'left' | 'right') => {
    if (disabled || !serialNumber || isSendingCommand) return;
    
    setIsSendingCommand(true);
    
    try {
      // Get the robot's current position
      const response = await fetch(`/api/robots/position/${serialNumber}`);
      const position = await response.json();
      const currentX = position.x || 0;
      const currentY = position.y || 0;
      const currentOrientation = position.orientation || 0;
      
      // Calculate distance based on speed and robot parameters
      // Use the configured max velocity from robot params if available
      const maxVelocity = direction === 'forward' 
        ? robotParams.maxForwardVel
        : Math.abs(robotParams.maxBackwardVel);
      
      // Scale the velocity based on the speed slider (0.1 to 1.0)
      const scaledVelocity = maxVelocity * speed;
      
      // Fixed distance and rotation values for consistent movement
      const distance = scaledVelocity * 1.0; // 1.0 meter movement
      const rotationAmount = robotParams.maxAngularVel * (speed / 2) * (Math.PI / 6); // Scale rotation by speed
      
      // Log the movement parameters for debugging
      console.log(`Movement: ${direction}, Speed: ${speed}, Distance: ${distance}, Rotation: ${rotationAmount}`);
      
      let moveData = {};
      
      switch (direction) {
        case 'forward':
          // FORWARD: Move in direction of current orientation
          const forwardX = currentX + Math.cos(currentOrientation) * distance;
          const forwardY = currentY + Math.sin(currentOrientation) * distance;
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: forwardX,
            target_y: forwardY,
            target_z: 0,
            target_ori: currentOrientation, // maintain orientation
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.01, // Very strict orientation accuracy
            properties: {
              inplace_rotate: false
            }
          };
          break;
          
        case 'backward':
          // BACKWARD: Move opposite to current orientation
          const backwardX = currentX - Math.cos(currentOrientation) * distance;
          const backwardY = currentY - Math.sin(currentOrientation) * distance;
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: backwardX,
            target_y: backwardY,
            target_z: 0,
            target_ori: currentOrientation, // maintain orientation
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.01, // Very strict orientation accuracy
            properties: {
              inplace_rotate: false
            }
          };
          break;
          
        case 'left':
          // LEFT: Robot turns counterclockwise in place
          moveData = {
            creator: "web_interface",
            type: "standard", 
            target_x: currentX,
            target_y: currentY,
            target_z: 0,
            target_ori: currentOrientation + rotationAmount, // add angle for counterclockwise
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.05,
            properties: {
              inplace_rotate: true // Important flag for in-place rotation
            }
          };
          break;
          
        case 'right':
          // RIGHT: Robot turns clockwise in place
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: currentX,
            target_y: currentY, 
            target_z: 0,
            target_ori: currentOrientation - rotationAmount, // subtract angle for clockwise
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.05,
            properties: {
              inplace_rotate: true // Important flag for in-place rotation
            }
          };
          break;
      }
      
      // Send the command through our server API
      const serverResponse = await fetch(`/api/robots/move/${serialNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });
      
      if (serverResponse.ok) {
        console.log(`${direction.toUpperCase()} command sent successfully`);
      } else {
        console.error(`${direction.toUpperCase()} command failed:`, await serverResponse.text());
      }
    } catch (error) {
      console.error(`Error sending ${direction} command:`, error);
    } finally {
      // Delay to prevent rapid command spamming
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 500); // Half-second delay between commands
    }
  };
  
  const handleStop = async () => {
    if (disabled || !serialNumber) return;
    setIsSendingCommand(true);
    
    try {
      // Send a stop command through the server API
      const response = await fetch(`/api/robots/move/${serialNumber}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: "cancelled" }),
      });
      
      if (response.ok) {
        console.log('Stop command sent successfully');
      } else {
        console.error('Stop command failed:', await response.text());
      }
    } catch (error) {
      console.error('Error sending stop command:', error);
    } finally {
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 200);
    }
  };
  
  // Handle speed slider change
  const handleSpeedChange = (value: number[]) => {
    setSpeed(value[0]);
  };
  
  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm">
          {errorMessage}
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Speed: {speed.toFixed(1)} m/s</span>
          {robotParamsLoaded && (
            <span className="text-xs text-muted-foreground">
              Using robot-specific parameters
            </span>
          )}
        </div>
        <Slider
          value={[speed]}
          min={0.1}
          max={1.0}
          step={0.1}
          onValueChange={handleSpeedChange}
          disabled={disabled}
          className="w-full"
        />
      </div>
      
      <div className="grid grid-cols-3 gap-2 max-w-[250px] mx-auto">
        {/* Empty cell (top-left) */}
        <div></div>
        
        {/* Forward button */}
        <Button
          variant="outline"
          size="lg"
          className="h-16 w-full"
          onClick={() => handleDirectionClick('forward')}
          disabled={disabled || isSendingCommand}
        >
          <ArrowUp className="h-10 w-10" />
        </Button>
        
        {/* Empty cell (top-right) */}
        <div></div>
        
        {/* Left button */}
        <Button
          variant="outline"
          size="lg"
          className="h-16 w-full"
          onClick={() => handleDirectionClick('left')}
          disabled={disabled || isSendingCommand}
        >
          <ArrowLeft className="h-10 w-10" />
        </Button>
        
        {/* Stop button (center) */}
        <Button
          variant="destructive"
          size="lg"
          className="h-16 w-full"
          onClick={handleStop}
          disabled={disabled || isSendingCommand}
        >
          <StopCircle className="h-10 w-10" />
        </Button>
        
        {/* Right button */}
        <Button
          variant="outline"
          size="lg"
          className="h-16 w-full"
          onClick={() => handleDirectionClick('right')}
          disabled={disabled || isSendingCommand}
        >
          <ArrowRight className="h-10 w-10" />
        </Button>
        
        {/* Empty cell (bottom-left) */}
        <div></div>
        
        {/* Backward button */}
        <Button
          variant="outline"
          size="lg"
          className="h-16 w-full"
          onClick={() => handleDirectionClick('backward')}
          disabled={disabled || isSendingCommand}
        >
          <ArrowDown className="h-10 w-10" />
        </Button>
        
        {/* Empty cell (bottom-right) */}
        <div></div>
      </div>
      
      {isSendingCommand && (
        <div className="text-center text-sm text-muted-foreground">
          Sending command...
        </div>
      )}
    </div>
  );
}