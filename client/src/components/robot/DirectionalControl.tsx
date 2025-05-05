import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, StopCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from '@/hooks/use-toast';

interface DirectionalControlProps {
  serialNumber: string;
  disabled?: boolean;
  compact?: boolean;
}

export function DirectionalControl({ serialNumber, disabled = false, compact = false }: DirectionalControlProps) {
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
    
    // Log which direction button was clicked for debugging
    console.log(`===== ${direction.toUpperCase()} BUTTON CLICKED =====`);
    
    setIsSendingCommand(true);
    
    try {
      // Use standard movement API for all directions
      // We've determined that the joystick API approach doesn't work reliably for forward
      
      // Get the robot's current position for other directions or fallback
      const response = await fetch(`/api/robots/position/${serialNumber}`);
      const position = await response.json();
      
      // Log the complete position data for debugging
      console.log('Robot position data from API:', JSON.stringify(position, null, 2));
      
      const currentX = position.x || 0;
      const currentY = position.y || 0;
      const currentOrientation = position.orientation || 0;
      
      // Check for theta value which is the actual robot orientation in radians
      const theta = position.theta || position.orientation || 0;
      console.log(`Using position values - X: ${currentX}, Y: ${currentY}, orientation: ${currentOrientation}, theta: ${theta}`);
      
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
          // FORWARD MOVEMENT - Completely different approach for forward
          // Use differential drive type command instead of standard
          console.log("USING DIFFERENTIAL DRIVE TYPE FOR FORWARD MOVEMENT");
          
          moveData = {
            creator: "web_interface",
            type: "differential",  // Key change: use differential drive type instead of standard
            linear_velocity: 0.4,  // Fixed moderate forward velocity (about half max)
            angular_velocity: 0,   // No rotation, just straight ahead
            duration: 3.0,         // Run for exactly 3 seconds - should move about 1 meter
            properties: {
              auto_hold: true      // Hold position after movement
            }
          };
          
          console.log("Forward command using differential drive:", JSON.stringify(moveData, null, 2));
          break;
          
        case 'backward':
          // BACKWARD MOVEMENT - Using same differential approach as forward
          console.log("USING DIFFERENTIAL DRIVE TYPE FOR BACKWARD MOVEMENT");
          
          moveData = {
            creator: "web_interface",
            type: "differential",  // Same type as forward for consistency
            linear_velocity: -0.4, // Negative velocity for backward (about half max)
            angular_velocity: 0,   // No rotation, just straight back
            duration: 3.0,         // Run for exactly 3 seconds - should move about 1 meter
            properties: {
              auto_hold: true      // Hold position after movement
            }
          };
          
          console.log("Backward command using differential drive:", JSON.stringify(moveData, null, 2));
          break;
          
        case 'left':
          // LEFT: Robot turns counterclockwise in place
          const thetaLeft = position.theta !== undefined ? position.theta : currentOrientation;
          
          console.log(`Left rotation calculation - Current pos: (${currentX}, ${currentY}), theta: ${thetaLeft}, rotation amount: ${rotationAmount}, target: ${thetaLeft + rotationAmount}`);
          
          moveData = {
            creator: "web_interface",
            type: "standard", 
            target_x: currentX,
            target_y: currentY,
            target_z: 0,
            target_ori: thetaLeft + rotationAmount, // add angle for counterclockwise
            target_accuracy: 0.1, // Slightly more lenient accuracy for rotations
            use_target_zone: true,
            target_orientation_accuracy: 0.1, // More lenient orientation accuracy
            properties: {
              inplace_rotate: true // Important flag for in-place rotation
            }
          };
          break;
          
        case 'right':
          // RIGHT: Robot turns clockwise in place
          const thetaRight = position.theta !== undefined ? position.theta : currentOrientation;
          
          console.log(`Right rotation calculation - Current pos: (${currentX}, ${currentY}), theta: ${thetaRight}, rotation amount: ${rotationAmount}, target: ${thetaRight - rotationAmount}`);
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: currentX,
            target_y: currentY, 
            target_z: 0,
            target_ori: thetaRight - rotationAmount, // subtract angle for clockwise
            target_accuracy: 0.1, // Slightly more lenient accuracy for rotations
            use_target_zone: true,
            target_orientation_accuracy: 0.1, // More lenient orientation accuracy
            properties: {
              inplace_rotate: true // Important flag for in-place rotation
            }
          };
          break;
      }
      
      // Log the actual movement data being sent to the robot
      console.log(`Sending ${direction} movement command:`, JSON.stringify(moveData, null, 2));
      
      // Send the command through our server API
      console.log(`SENDING ${direction.toUpperCase()} command to API endpoint: /api/robots/move/${serialNumber}`);
      
      const serverResponse = await fetch(`/api/robots/move/${serialNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });
      
      // More detailed response logging to debug what's actually happening
      if (serverResponse.ok) {
        const responseData = await serverResponse.json();
        console.log(`${direction.toUpperCase()} COMMAND ACCEPTED:`, responseData);
        
        // Show successful toast for user feedback (only in non-compact mode)
        if (!compact) {
          toast({
            title: "Movement command sent",
            description: `${direction.charAt(0).toUpperCase() + direction.slice(1)} movement initiated`,
            variant: "default",
          });
        }
      } else {
        // Log detailed error information
        const errorText = await serverResponse.text();
        console.error(`${direction.toUpperCase()} COMMAND FAILED:`, {
          status: serverResponse.status,
          statusText: serverResponse.statusText,
          errorDetails: errorText
        });
        
        // Show error toast
        toast({
          title: "Movement failed",
          description: `Could not send ${direction} command to robot: ${serverResponse.statusText}`,
          variant: "destructive",
        });
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
      // First try to stop using the joystick API (to handle joystick-based movement)
      try {
        const joystickStopResponse = await fetch(`/api/robots/joystick/${serialNumber}/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (joystickStopResponse.ok) {
          console.log('Joystick stop command sent successfully');
        } else {
          console.error('Joystick stop command failed:', await joystickStopResponse.text());
        }
      } catch (joystickError) {
        console.error('Error sending joystick stop command:', joystickError);
      }
      
      // Also send the regular stop command to ensure we handle all movement types
      const moveStopResponse = await fetch(`/api/robots/move/${serialNumber}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: "cancelled" }),
      });
      
      if (moveStopResponse.ok) {
        console.log('Move stop command sent successfully');
      } else {
        console.error('Move stop command failed:', await moveStopResponse.text());
      }
    } catch (error) {
      console.error('Error sending stop commands:', error);
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
  
  // Handle jack up command
  const handleJackUp = async () => {
    if (disabled || !serialNumber || isSendingCommand) return;
    
    setIsSendingCommand(true);
    
    try {
      console.log(`Sending jack up command for robot ${serialNumber}`);
      
      const response = await fetch(`/api/robots/jack/${serialNumber}/up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('Jack up command sent successfully');
        toast({
          title: "Success",
          description: "Robot jack up command sent",
          variant: "default",
        });
      } else {
        const errorData = await response.json();
        console.error('Jack up command failed:', errorData);
        toast({
          title: "Error",
          description: errorData.message || "Failed to jack up robot",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending jack up command:', error);
      toast({
        title: "Error",
        description: "Failed to send jack up command",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 500);
    }
  };
  
  // Handle jack down command
  const handleJackDown = async () => {
    if (disabled || !serialNumber || isSendingCommand) return;
    
    setIsSendingCommand(true);
    
    try {
      console.log(`Sending jack down command for robot ${serialNumber}`);
      
      const response = await fetch(`/api/robots/jack/${serialNumber}/down`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('Jack down command sent successfully');
        toast({
          title: "Success",
          description: "Robot jack down command sent",
          variant: "default",
        });
      } else {
        const errorData = await response.json();
        console.error('Jack down command failed:', errorData);
        toast({
          title: "Error",
          description: errorData.message || "Failed to jack down robot",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending jack down command:', error);
      toast({
        title: "Error",
        description: "Failed to send jack down command",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 500);
    }
  };
  
  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-6'}`}>
      {errorMessage && !compact && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm">
          {errorMessage}
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}>Speed: {speed.toFixed(1)} m/s</span>
          {robotParamsLoaded && !compact && (
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
      
      <div className={`grid grid-cols-3 gap-2 ${compact ? 'max-w-full' : 'max-w-[250px] mx-auto'}`}>
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
      
      {/* Jack Control Section */}
      <div className={`border-t ${compact ? 'pt-2 mt-2' : 'pt-4 mt-4'}`}>
        <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-medium ${compact ? 'mb-2' : 'mb-3'}`}>Jack Control</h3>
        <div className={`grid grid-cols-2 gap-2 ${compact ? 'max-w-full' : 'max-w-[250px] mx-auto gap-4'}`}>
          {/* Jack Up button */}
          <Button
            variant="outline"
            size="default"
            onClick={handleJackUp}
            disabled={disabled || isSendingCommand}
            className="flex items-center justify-center gap-2"
          >
            <ChevronUp className="h-5 w-5" />
            <span>Jack Up</span>
          </Button>
          
          {/* Jack Down button */}
          <Button
            variant="outline"
            size="default"
            onClick={handleJackDown}
            disabled={disabled || isSendingCommand}
            className="flex items-center justify-center gap-2"
          >
            <ChevronDown className="h-5 w-5" />
            <span>Jack Down</span>
          </Button>
        </div>
      </div>
      
      {isSendingCommand && (
        <div className="text-center text-sm text-muted-foreground">
          Sending command...
        </div>
      )}
    </div>
  );
}