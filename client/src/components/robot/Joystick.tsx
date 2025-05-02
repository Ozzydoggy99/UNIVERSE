import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JoystickProps {
  serialNumber: string;
  disabled?: boolean;
}

export function Joystick({ serialNumber, disabled = false }: JoystickProps) {
  const { toast } = useToast();
  const joystickRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(0.2); // default speed in m/s
  const [isDragging, setIsDragging] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [normalizedPosition, setNormalizedPosition] = useState({ x: 0, y: 0 });
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const moveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the most recent command type to ensure consistent movements
  const lastCommandTypeRef = useRef<'forward' | 'rotation' | 'combined' | null>(null);

  // Clean up any timers when component unmounts
  useEffect(() => {
    return () => {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
      }
    };
  }, []);

  // Fix the movement API endpoint
  const sendMoveCommand = async (xDir: number, yDir: number, isRotating: boolean = false) => {
    if (disabled || !serialNumber || (xDir === 0 && yDir === 0)) return;
    
    setIsSendingCommand(true);
    
    try {
      // Get the robot's current position first
      const positionResponse = await fetch(`/api/robots/position/${serialNumber}`);
      if (!positionResponse.ok) {
        throw new Error(`Failed to get robot position: ${positionResponse.statusText}`);
      }
      
      const position = await positionResponse.json();
      const currentX = position.x || 0;
      const currentY = position.y || 0;
      const currentOrientation = position.orientation || 0;
      
      // Calculate new target position based on joystick position and speed
      let targetX = currentX;
      let targetY = currentY;
      let targetOrientation = currentOrientation; // Keep current orientation by default
      
      // Use a larger distance value to make movement more noticeable
      const distance = speed * 0.75; // 0.75 meters at full speed
      
      if (isRotating) {
        // If it's a rotation movement, make rotation more responsive
        targetOrientation = currentOrientation + (xDir * Math.PI/2); // Rotate 90 degrees at full deflection
      } else {
        // For regular movement - move in the direction of the joystick relative to the robot's current orientation
        targetX = currentX + Math.cos(currentOrientation) * yDir * distance;
        targetY = currentY + Math.sin(currentOrientation) * yDir * distance;
        
        // Add strafing movement (left/right)
        targetX += Math.cos(currentOrientation - Math.PI/2) * xDir * distance;
        targetY += Math.sin(currentOrientation - Math.PI/2) * xDir * distance;
      }
      
      console.log(`Moving robot to: (${targetX.toFixed(3)}, ${targetY.toFixed(3)}), orientation: ${targetOrientation.toFixed(3)}`);
      
      // Construct the move command payload according to API documentation
      const moveData = {
        creator: "web_interface",
        type: "standard",
        target_x: targetX,
        target_y: targetY,
        target_z: 0,
        target_ori: targetOrientation,
        target_accuracy: 0.05, // 5cm accuracy for more precise movement
        use_target_zone: true, // Added this parameter to make movement more responsive
        properties: {
          inplace_rotate: isRotating
        }
      };
      
      // Try a direct API call first as a test (for debugging - will be removed later)
      console.log('Attempting direct API call to robot...');
      try {
        // Debug directly with the physical robot
        const directResponse = await fetch('http://47.180.91.99:8090/chassis/moves', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(moveData),
        });
        
        if (directResponse.ok) {
          const directResult = await directResponse.json();
          console.log('Direct API call successful:', directResult);
          // No need to continue with the server API call
          return;
        } else {
          console.error('Direct API call failed:', await directResponse.text());
          // Continue with the server API call as fallback
        }
      } catch (directErr) {
        console.error('Direct API call error:', directErr);
        // Continue with the server API call as fallback
      }
      
      // Send the command through our server API
      console.log('Sending move command through server API');
      const response = await fetch(`/api/robots/move/${serialNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send move command: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Move command result:', result);
    } catch (error) {
      console.error('Error sending move command:', error);
      toast({
        title: 'Error',
        description: `Failed to send move command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSendingCommand(false);
    }
  };

  const handleStopMovement = async () => {
    if (disabled || !serialNumber) return;
    setIsSendingCommand(true);
    
    try {
      console.log('Sending stop command via button');
      
      // Use our server API for the stop command
      const response = await fetch(`/api/robots/move/${serialNumber}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: "cancelled" }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send stop command: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Stop command result:', result);
      
      toast({
        title: 'Movement stopped',
        description: 'Robot has been commanded to stop all movement',
      });
    } catch (error) {
      console.error('Error sending stop command:', error);
      toast({
        title: 'Error',
        description: `Failed to stop movement: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Handle joystick mouse/touch events
  const handleJoystickStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    
    setIsDragging(true);
    updateJoystickPosition(clientX, clientY);
    
    // We'll send commands directly on position updates instead of using intervals
    // This should be much more responsive
  };

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    updateJoystickPosition(clientX, clientY);
  };

  const handleJoystickEnd = async () => {
    setIsDragging(false);
    resetJoystickPosition();
    
    // Stop sending movement commands
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
    
    if (!serialNumber) return;
    
    // Send a stop command through our server API when joystick is released
    try {
      console.log('Sending stop command on joystick release');
      const stopResponse = await fetch(`/api/robots/move/${serialNumber}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: "cancelled" }),
      });
      
      if (stopResponse.ok) {
        console.log('Stop command successful');
      } else {
        console.error('Stop command failed', await stopResponse.text());
      }
    } catch (error) {
      console.error('Error sending stop command:', error);
    }
  };

  const updateJoystickPosition = (clientX: number, clientY: number) => {
    if (!joystickRef.current || !handleRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const joystickRect = joystickRef.current.getBoundingClientRect();
    
    const centerX = joystickRect.left + joystickRect.width / 2;
    const centerY = joystickRect.top + joystickRect.height / 2;
    
    // Calculate the offset from the center
    let offsetX = clientX - centerX;
    let offsetY = clientY - centerY;
    
    // Calculate the distance from center
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const radius = joystickRect.width / 2 - handleRef.current.offsetWidth / 2;
    
    // If the handle is being dragged outside the joystick's radius, limit it
    if (distance > radius) {
      const angle = Math.atan2(offsetY, offsetX);
      offsetX = Math.cos(angle) * radius;
      offsetY = Math.sin(angle) * radius;
    }
    
    // Update the handle position
    setJoystickPosition({ x: offsetX, y: offsetY });
    
    // Calculate normalized position (-1 to 1 range)
    const normalizedX = offsetX / radius;
    const normalizedY = offsetY / radius;
    setNormalizedPosition({ x: normalizedX, y: normalizedY });
    
    // Only send command if position has changed significantly
    if (isDragging && (Math.abs(normalizedX) > 0.05 || Math.abs(normalizedY) > 0.05)) {
      // Send command immediately on joystick update - more responsive
      console.log('Direct joystick command:', normalizedX, -normalizedY);
      sendDirectCommand(normalizedX, -normalizedY);
    }
  };
  
  // Send movement commands through our server (to avoid CORS issues)
  const sendDirectCommand = async (xDir: number, yDir: number) => {
    if (disabled || !serialNumber || isSendingCommand) return;
    
    // Prevent rapid-fire commands
    setIsSendingCommand(true);
    
    try {
      // Get the robot's current position
      const response = await fetch(`/api/robots/position/${serialNumber}`);
      const position = await response.json();
      const currentX = position.x || 0;
      const currentY = position.y || 0;
      const currentOrientation = position.orientation || 0;

      // Create thresholds for different movement types, with more leeway for human control
      // Wider threshold for detecting rotation - if x-axis movement is significant and y-axis is minimal
      const isRotationCommand = Math.abs(xDir) > 0.15 && Math.abs(yDir) < 0.25;
      // Wider threshold for forward/backward - if y-axis movement is significant and x-axis is less than 1/3
      const isForwardCommand = Math.abs(yDir) > 0.15 && Math.abs(xDir) < 0.33;
      
      // For consistent movement patterns, if we previously determined the command type
      // and we're only making small joystick adjustments, keep the same command type
      const currentCommandType = 
        isRotationCommand ? 'rotation' : 
        isForwardCommand ? 'forward' : 'combined';
      
      // Special case: if we're in forward/backward mode, we want to be much stricter about
      // preventing any sideways (strafing) movement to ensure perfect straight line movement
      if (lastCommandTypeRef.current === 'forward') {
        // When already in forward/backward mode, make xDir zero to prevent any strafing
        xDir = 0;
        console.log('In forward/backward mode - removing any lateral/strafing component');
        
        // Only exit forward mode if there's almost no vertical input
        // Give a bit more leeway here too to accommodate human joystick control
        if (Math.abs(yDir) < 0.08) {
          lastCommandTypeRef.current = currentCommandType;
        }
      } else {
        // If not already in forward mode, follow normal command type switching
        lastCommandTypeRef.current = currentCommandType;
      }
      
      let moveData = {};
      
      if (lastCommandTypeRef.current === 'rotation') {
        // Pure rotation command - rotate in place without moving
        // REVERSE the direction (flip the sign) since controls are reversed
        const rotationDirection = xDir > 0 ? -1 : 1;
        // Use a larger rotation amount for more noticeable turning
        const rotationAmount = Math.abs(xDir) * (Math.PI / 4); // Increased to 45 degrees max
        
        moveData = {
          creator: "web_interface",
          type: "standard",
          target_x: currentX, // Stay in same position
          target_y: currentY, // Stay in same position
          target_z: 0,
          target_ori: currentOrientation + (rotationDirection * rotationAmount),
          target_accuracy: 0.05,
          use_target_zone: true,
          properties: {
            inplace_rotate: true // Critical for pure rotation
          }
        };
        
        console.log('Sending rotation command, amount:', rotationDirection * rotationAmount);
      } 
      else if (lastCommandTypeRef.current === 'forward') {
        // Pure forward/backward movement with EXACT same orientation
        // Use a larger distance increment for more noticeable movement
        const distance = yDir * speed * 0.5; // Increased for more substantial movement
        
        // Calculate target coordinates using the current orientation vector
        const targetX = currentX + Math.cos(currentOrientation) * distance;
        const targetY = currentY + Math.sin(currentOrientation) * distance;
        
        moveData = {
          creator: "web_interface",
          type: "standard",
          target_x: targetX,
          target_y: targetY,
          target_z: 0,
          target_ori: currentOrientation, // No rotation at all in forward/backward mode
          target_accuracy: 0.05,
          use_target_zone: true,
          properties: {
            // Always set no_rotate for both forward and backward in strict forward mode
            // This ensures the robot maintains exact orientation
            no_rotate: true,
            inplace_rotate: false // Explicitly set to false to prevent any rotation
          }
        };
        
        // Indicate direction in log message
        const directionWord = yDir > 0 ? "FORWARD" : "BACKWARD";
        console.log(`Sending STRICT ${directionWord} command, distance:`, distance, 'orientation:', currentOrientation);
      }
      else { // combined
        // Combined movement (both rotation and forward/backward)
        // For combined movement, we'll use the same larger distance as forward mode
        const distance = yDir * speed * 0.5; // Increased for more substantial movement
        
        // REVERSE the direction (flip the sign) for rotation since controls are reversed
        const rotationDirection = xDir > 0 ? -1 : 1;
        // Make the rotation more noticeable in combined mode too
        const rotationAmount = Math.abs(xDir) * (Math.PI / 12); // Increased rotation (15 degrees max)
        
        // Calculate target position
        const targetX = currentX + Math.cos(currentOrientation) * distance;
        const targetY = currentY + Math.sin(currentOrientation) * distance;
        
        // Calculate new orientation - with extremely small rotation
        const targetOrientation = currentOrientation + (rotationDirection * rotationAmount);
        
        moveData = {
          creator: "web_interface",
          type: "standard",
          target_x: targetX,
          target_y: targetY,
          target_z: 0,
          target_ori: targetOrientation,
          target_accuracy: 0.05,
          use_target_zone: true,
          properties: {
            // For forward movement, use extremely minimal rotation
            // For backward movement, prevent rotation altogether
            inplace_rotate: false,
            no_rotate: yDir < 0 ? true : undefined
          }
        };
        
        console.log('Sending combined command, distance:', distance, 'rotation:', rotationAmount);
      }
      
      // Use our server API instead of direct calls to avoid CORS issues
      const serverResponse = await fetch(`/api/robots/move/${serialNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moveData),
      });
      
      if (serverResponse.ok) {
        console.log('Movement command sent successfully');
      } else {
        console.error('Movement command failed:', await serverResponse.text());
      }
    } catch (error) {
      console.error('Error sending movement command:', error);
    } finally {
      // Allow new commands after a short delay
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 30); // Keep the 30ms for responsive control
    }
  };

  const resetJoystickPosition = () => {
    setJoystickPosition({ x: 0, y: 0 });
    setNormalizedPosition({ x: 0, y: 0 });
  };

  // Set up mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleJoystickMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleJoystickEnd();
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Set up touch event handlers
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    
    const handleTouchEnd = () => handleJoystickEnd();
    
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Speed:</div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSpeed(Math.max(0.1, speed - 0.1))}
            disabled={disabled || speed <= 0.1}
          >
            -
          </Button>
          <span className="w-16 text-center">{speed.toFixed(1)} m/s</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSpeed(Math.min(1.0, speed + 0.1))}
            disabled={disabled || speed >= 1.0}
          >
            +
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col items-center" ref={containerRef}>
        {/* Joystick container */}
        <div 
          ref={joystickRef}
          className="w-48 h-48 rounded-full bg-secondary border-4 border-muted-foreground/20 relative"
          onMouseDown={(e) => handleJoystickStart(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handleJoystickStart(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
        >
          {/* Joystick handle */}
          <div
            ref={handleRef}
            className="w-12 h-12 rounded-full bg-primary absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{
              left: `calc(50% + ${joystickPosition.x}px)`,
              top: `calc(50% + ${joystickPosition.y}px)`,
              transition: isDragging ? 'none' : 'all 0.2s ease-out'
            }}
          />
          
          {/* Crosshair guides */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted-foreground/20"></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted-foreground/20"></div>
        </div>
        
        {/* Stop button */}
        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 mt-4"
          onClick={handleStopMovement}
          disabled={disabled || isSendingCommand}
        >
          <StopCircle className="h-6 w-6" />
        </Button>
        
        {isSendingCommand && (
          <div className="text-center text-sm text-muted-foreground mt-2">
            Sending command...
          </div>
        )}
        
        {/* Debug values */}
        <div className="text-xs text-muted-foreground mt-2">
          <div>X: {normalizedPosition.x.toFixed(2)}, Y: {normalizedPosition.y.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}