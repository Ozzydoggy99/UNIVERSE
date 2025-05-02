import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JoystickProps {
  serialNumber: string;
  disabled?: boolean;
}

export function SimpleJoystick({ serialNumber, disabled = false }: JoystickProps) {
  const { toast } = useToast();
  const joystickRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(0.5); // Increased default speed for more noticeable movement
  const [isDragging, setIsDragging] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [normalizedPosition, setNormalizedPosition] = useState({ x: 0, y: 0 });
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const moveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up any timers when component unmounts
  useEffect(() => {
    return () => {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
      }
    };
  }, []);

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
      
      console.log('Stop command sent successfully');
    } catch (error) {
      console.error('Error sending stop command:', error);
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Handle joystick mouse/touch events
  const handleJoystickStart = (clientX: number, clientY: number) => {
    if (disabled) return;
    
    setIsDragging(true);
    updateJoystickPosition(clientX, clientY);
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
    
    // Stop the robot when the joystick is released
    if (serialNumber) {
      await handleStopMovement();
    }
  };

  const resetJoystickPosition = () => {
    setJoystickPosition({ x: 0, y: 0 });
    setNormalizedPosition({ x: 0, y: 0 });
  };

  const updateJoystickPosition = (clientX: number, clientY: number) => {
    if (!joystickRef.current || !handleRef.current || !containerRef.current) return;
    
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
    if (isDragging && (Math.abs(normalizedX) > 0.1 || Math.abs(normalizedY) > 0.1)) {
      // Send command immediately on joystick update for immediate response
      sendDirectCommand(normalizedX, -normalizedY);
      
      // Setup continuous movement updates with a reasonable interval
      if (!moveIntervalRef.current) {
        moveIntervalRef.current = setInterval(() => {
          if (isDragging && !isSendingCommand) {
            sendDirectCommand(normalizedX, -normalizedY);
          }
        }, 400); // 400ms for good responsiveness without overwhelming the robot
      }
    } else if (moveIntervalRef.current && Math.abs(normalizedX) <= 0.1 && Math.abs(normalizedY) <= 0.1) {
      // If joystick is basically centered, clear the interval
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  };
  
  // Send movement commands through our server
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

      // SIMPLIFIED APPROACH:
      // 1. Detect dominant direction (x or y axis)
      // 2. Use ONLY that axis and zero out the other
      // This prevents diagonal/combined movements that cause issues
      
      // Determine which axis has more input
      const absX = Math.abs(xDir);
      const absY = Math.abs(yDir);
      
      // Zero out the non-dominant axis and use fixed values for consistency
      if (absX > absY) {
        // LEFT or RIGHT movement (rotation in place)
        yDir = 0;
        xDir = xDir > 0 ? 0.8 : -0.8; // Fixed rotation strength for consistency
      } else {
        // FORWARD or BACKWARD movement
        xDir = 0;
        yDir = yDir > 0 ? 0.8 : -0.8; // Fixed movement strength for consistency
      }
      
      // Fixed distance for consistent movement
      const distance = speed * 1.0; // 1.0 meter per command (increased from previous values)
      
      // Fixed rotation amount for turning
      const rotationAmount = Math.PI / 6; // 30 degrees
      
      let moveData = {};
      
      if (absX > absY) {
        // LEFT or RIGHT movement (rotation in place)
        if (xDir < 0) {
          // LEFT: Robot turns counterclockwise
          moveData = {
            creator: "web_interface",
            type: "standard", 
            target_x: currentX,
            target_y: currentY,
            target_z: 0,
            target_ori: currentOrientation + rotationAmount, // add positive angle for counterclockwise
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.05,
            properties: {
              inplace_rotate: true
            }
          };
        } else {
          // RIGHT: Robot turns clockwise
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
              inplace_rotate: true
            }
          };
        }
      } else {
        // FORWARD or BACKWARD movement
        if (yDir > 0) {
          // FORWARD: Move in direction of current orientation
          const targetX = currentX + Math.cos(currentOrientation) * distance;
          const targetY = currentY + Math.sin(currentOrientation) * distance;
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: targetX,
            target_y: targetY,
            target_z: 0,
            target_ori: currentOrientation, // maintain orientation
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.01,
            properties: {
              inplace_rotate: false
            }
          };
        } else {
          // BACKWARD: Move opposite to current orientation
          const targetX = currentX - Math.cos(currentOrientation) * distance;
          const targetY = currentY - Math.sin(currentOrientation) * distance;
          
          moveData = {
            creator: "web_interface",
            type: "standard",
            target_x: targetX,
            target_y: targetY,
            target_z: 0,
            target_ori: currentOrientation, // maintain orientation
            target_accuracy: 0.05,
            use_target_zone: true,
            target_orientation_accuracy: 0.01,
            properties: {
              inplace_rotate: false
            }
          };
        }
      }
      
      // Send command via server API to avoid CORS issues
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
      // Use shorter delay for more responsive controls
      setTimeout(() => {
        setIsSendingCommand(false);
      }, 100); // Only 100ms delay for responsive controls
    }
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