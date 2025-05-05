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
    
    setIsSendingCommand(true);
    
    try {
      // For forward movement, use the joystick API which is more reliable
      if (direction === 'forward') {
        console.log(`Using joystick API for forward movement with speed ${speed}`);
        
        // Get the robot's current position for forward movement
        const posResponse = await fetch(`/api/robots/position/${serialNumber}`);
        const position = await posResponse.json();
        
        // Log the complete position data for debugging
        console.log('Robot position data from API before forward movement:', JSON.stringify(position, null, 2));
        
        const currentX = position.x || 0;
        const currentY = position.y || 0;
        const currentOrientation = position.orientation || position.theta || 0;
        
        // Calculate target position 1 meter in front of the robot
        const moveDistance = 1.0; // Exactly 1 meter as requested
        const targetX = currentX + Math.cos(currentOrientation) * moveDistance;
        const targetY = currentY + Math.sin(currentOrientation) * moveDistance;
        
        console.log(`FORWARD movement with fixed 1m distance: current (${currentX}, ${currentY}), orientation: ${currentOrientation}, target: (${targetX}, ${targetY})`);
        
        // Send joystick command with position parameters for exactly 1 meter movement
        const joystickResponse = await fetch(`/api/robots/joystick/${serialNumber}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linear: 1.0, // Full speed for precise 1-meter movement
            angular: 0,  // No angular velocity (straight ahead)
            exactDistance: moveDistance, // Flag for exact 1-meter movement
            targetX: targetX,
            targetY: targetY
          }),
        });
        
        if (joystickResponse.ok) {
          console.log('FORWARD joystick command sent successfully');
          const response = await joystickResponse.json();
          console.log('Joystick response:', response);
          
          setIsSendingCommand(false);
          return; // Return early since we're using a different API for forward movement
        } else {
          console.error('FORWARD joystick command failed:', await joystickResponse.text());
          // Fall back to standard movement if joystick command fails
        }
      }
      
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
          // FORWARD: Move in direction of current orientation
          // The critical fix is to explicitly use the robot's theta value for orientation calculation
          // Note that theta is the correct orientation parameter from the server, not "orientation"
          const theta = position.theta !== undefined ? position.theta : currentOrientation;
          
          // Calculate target position based on theta for the forward direction
          // Important: We need to use a larger distance to make forward movement noticeable
          // Increase the distance by multiplying by 1.5 to make forward movement more effective
          const adjustedDistance = distance * 1.5;
          const forwardX = currentX + Math.cos(theta) * adjustedDistance;
          const forwardY = currentY + Math.sin(theta) * adjustedDistance;
          
          console.log(`Forward move calculation - Current pos: (${currentX}, ${currentY}), theta: ${theta}, distance: ${adjustedDistance}, target: (${forwardX}, ${forwardY})`);
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: forwardX,
            target_y: forwardY,
            target_z: 0,
            target_ori: theta, // Use theta for orientation to maintain direction
            target_accuracy: 0.2, // Even more lenient accuracy for forward movement
            use_target_zone: true,
            target_orientation_accuracy: 0.2, // More lenient orientation accuracy for forward movement
            properties: {
              inplace_rotate: false, // Ensure it's not an in-place rotation
              follow_path: true // Add follow_path property which helps with forward movement
            }
          };
          break;
          
        case 'backward':
          // BACKWARD: Move opposite to current orientation
          // Use theta for consistency with forward movement
          const thetaBack = position.theta !== undefined ? position.theta : currentOrientation;
          
          // Calculate target position based on theta for the backward direction
          // Important: We need to use a larger distance to make backward movement noticeable
          // Increase the distance by multiplying by 1.5 to make backward movement more effective
          const adjustedDistanceBack = distance * 1.5;
          const backwardX = currentX - Math.cos(thetaBack) * adjustedDistanceBack;
          const backwardY = currentY - Math.sin(thetaBack) * adjustedDistanceBack;
          
          console.log(`Backward move calculation - Current pos: (${currentX}, ${currentY}), theta: ${thetaBack}, distance: ${adjustedDistanceBack}, target: (${backwardX}, ${backwardY})`);
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: backwardX,
            target_y: backwardY,
            target_z: 0,
            target_ori: thetaBack, // Use theta for orientation to maintain direction
            target_accuracy: 0.2, // Slightly more lenient accuracy for movement
            use_target_zone: true,
            target_orientation_accuracy: 0.2, // More lenient orientation accuracy
            properties: {
              inplace_rotate: false, // Ensure it's not an in-place rotation
              follow_path: true // Add follow_path property which helps with movement
            }
          };
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