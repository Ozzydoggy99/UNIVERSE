import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, StopCircle, RotateCcw, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JoystickProps {
  serialNumber: string;
  disabled?: boolean;
}

export function Joystick({ serialNumber, disabled = false }: JoystickProps) {
  const { toast } = useToast();
  const [activeDirection, setActiveDirection] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(0.2); // default speed in m/s
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  // Clean up any timers when component unmounts
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Handle sending move commands to the robot
  const sendMoveCommand = async (type: string, x: number = 0, y: number = 0, orientation: number | null = null) => {
    if (disabled || !serialNumber) return;
    
    setIsSendingCommand(true);
    
    try {
      // Construct the move command payload
      const moveData = {
        creator: "web_interface",
        type: "standard",
        target_x: x,
        target_y: y,
        target_ori: orientation,
        properties: {
          inplace_rotate: type.includes('rotate')
        }
      };
      
      console.log('Sending move command:', moveData);
      
      // Send the command to the server
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
      
      toast({
        title: 'Move command sent',
        description: `The robot is moving ${type}`,
      });
    } catch (error) {
      console.error('Error sending move command:', error);
      toast({
        title: 'Error',
        description: 'Failed to send move command',
        variant: 'destructive',
      });
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Calculate target positions based on current position and direction
  const handleMove = (direction: string) => {
    if (disabled) return;
    
    setActiveDirection(direction);
    
    // Get the robot's current position first
    fetch(`/api/robots/position/${serialNumber}`)
      .then(res => res.json())
      .then(position => {
        const currentX = position.x || 0;
        const currentY = position.y || 0;
        const currentOrientation = position.orientation || 0;
        
        // Calculate new target position based on direction and speed
        let targetX = currentX;
        let targetY = currentY;
        let targetOrientation = null;
        
        const distance = speed; // How far to move in meters
        
        switch (direction) {
          case 'forward':
            targetX = currentX + Math.cos(currentOrientation) * distance;
            targetY = currentY + Math.sin(currentOrientation) * distance;
            break;
          case 'backward':
            targetX = currentX - Math.cos(currentOrientation) * distance;
            targetY = currentY - Math.sin(currentOrientation) * distance;
            break;
          case 'left':
            targetX = currentX + Math.cos(currentOrientation - Math.PI/2) * distance;
            targetY = currentY + Math.sin(currentOrientation - Math.PI/2) * distance;
            break;
          case 'right':
            targetX = currentX + Math.cos(currentOrientation + Math.PI/2) * distance;
            targetY = currentY + Math.sin(currentOrientation + Math.PI/2) * distance;
            break;
          case 'rotate-left':
            targetOrientation = currentOrientation - Math.PI/4; // Rotate 45 degrees left
            targetX = currentX;
            targetY = currentY;
            break;
          case 'rotate-right':
            targetOrientation = currentOrientation + Math.PI/4; // Rotate 45 degrees right
            targetX = currentX;
            targetY = currentY;
            break;
          case 'stop':
            // For stop, we send the current position to halt movement
            break;
          default:
            return;
        }
        
        // Send the move command with the calculated target
        sendMoveCommand(direction, targetX, targetY, targetOrientation);
      })
      .catch(error => {
        console.error('Error getting robot position:', error);
        toast({
          title: 'Error',
          description: 'Failed to get robot position',
          variant: 'destructive',
        });
      });
  };

  // Handle mouse/touch events
  const handleMouseDown = (direction: string) => {
    if (disabled) return;
    
    handleMove(direction);
    
    // Set up a timer for continuous movement if button is held
    longPressTimer.current = setTimeout(() => {
      // Continuous movement logic could be added here
      // For safety, we'll just trigger one movement per press for now
    }, 300);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setActiveDirection(null);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Robot Control</CardTitle>
        <CardDescription>
          Use the joystick to move the robot manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
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
          
          <div className="grid grid-cols-3 gap-2 w-full max-w-[300px] mx-auto">
            {/* Top row - rotate left, forward, rotate right */}
            <Button
              variant={activeDirection === 'rotate-left' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('rotate-left')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('rotate-left')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
            <Button
              variant={activeDirection === 'forward' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('forward')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('forward')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
            <Button
              variant={activeDirection === 'rotate-right' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('rotate-right')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('rotate-right')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <RotateCw className="h-6 w-6" />
            </Button>
            
            {/* Middle row - left, stop, right */}
            <Button
              variant={activeDirection === 'left' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('left')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('left')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-14 w-14"
              onClick={() => handleMove('stop')}
              disabled={disabled || isSendingCommand}
            >
              <StopCircle className="h-6 w-6" />
            </Button>
            <Button
              variant={activeDirection === 'right' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('right')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('right')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <ArrowRight className="h-6 w-6" />
            </Button>
            
            {/* Bottom row - backward */}
            <div></div>
            <Button
              variant={activeDirection === 'backward' ? 'default' : 'outline'}
              size="icon"
              className="h-14 w-14"
              onMouseDown={() => handleMouseDown('backward')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('backward')}
              onTouchEnd={handleMouseUp}
              disabled={disabled || isSendingCommand}
            >
              <ArrowDown className="h-6 w-6" />
            </Button>
            <div></div>
          </div>
          
          {isSendingCommand && (
            <div className="text-center text-sm text-muted-foreground mt-2">
              Sending command...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}