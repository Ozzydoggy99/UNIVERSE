import React, { useEffect, useRef } from 'react';

// Simple map visualization component for pages that don't have full robot data
export function MapVisualization({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a grid
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw sample obstacles
    ctx.fillStyle = '#f44336';
    const obstacles = [
      { x: 50, y: 50 },
      { x: 150, y: 120 },
      { x: 250, y: 80 },
    ];
    
    obstacles.forEach(obstacle => {
      ctx.beginPath();
      ctx.arc(obstacle.x, obstacle.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw sample path
    ctx.strokeStyle = '#3f51b5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(100, 70);
    ctx.lineTo(150, 100);
    ctx.lineTo(200, 150);
    ctx.stroke();
    
    // Draw sample robot
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(100, 70, 8, 0, Math.PI * 2);
    ctx.fill();
    
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={600} 
      className={`w-full h-full bg-white rounded-md ${className}`}
    />
  );
}

interface MapPoint {
  x: number;
  y: number;
  z: number;
}

interface MapPath {
  points: MapPoint[];
  status: string;
}

interface MapData {
  grid: any[];
  obstacles: MapPoint[];
  paths: MapPath[];
}

interface RobotStatus {
  model: string;
  serialNumber: string;
  battery: number;
  status: string;
  mode: string;
  lastUpdate: string;
}

interface RobotPosition {
  x: number;
  y: number;
  z: number;
  orientation: number;
  speed: number;
  timestamp: string;
}

interface RobotSensorData {
  temperature: number;
  voltage?: number;
  current?: number;
  battery: number;
  power_supply_status?: string;
  timestamp: string;
  charging?: boolean;
  connectionStatus?: string;
  humidity?: number;
  proximity?: number[];
}

interface MapProps {
  robotStatus: RobotStatus;
  robotPosition: RobotPosition;
  sensorData: RobotSensorData;
  mapData: MapData;
}

export function Map({ robotStatus, robotPosition, sensorData, mapData }: MapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw the map whenever the data changes
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scaling factor to fit map data into the canvas
    const points = [
      robotPosition,
      ...(mapData.obstacles || []),
      ...(mapData.paths || []).flatMap(path => path.points || [])
    ];
    
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    const mapWidth = maxX - minX + 50;  // Add margin
    const mapHeight = maxY - minY + 50;  // Add margin
    
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Function to transform map coordinates to canvas coordinates
    const transformX = (x: number) => (x - minX + 25) * scale;
    const transformY = (y: number) => canvas.height - (y - minY + 25) * scale;
    
    // Draw a grid (optional)
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    
    for (let x = 0; x <= mapWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(transformX(x + minX - 25), transformY(minY - 25));
      ctx.lineTo(transformX(x + minX - 25), transformY(maxY + 25));
      ctx.stroke();
    }
    
    for (let y = 0; y <= mapHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(transformX(minX - 25), transformY(y + minY - 25));
      ctx.lineTo(transformX(maxX + 25), transformY(y + minY - 25));
      ctx.stroke();
    }
    
    // Draw obstacles
    ctx.fillStyle = '#f44336';
    if (mapData.obstacles && mapData.obstacles.length) {
      mapData.obstacles.forEach(obstacle => {
        ctx.beginPath();
        ctx.arc(transformX(obstacle.x), transformY(obstacle.y), 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // Draw paths
    if (mapData.paths && mapData.paths.length) {
      mapData.paths.forEach(path => {
        if (path.points && path.points.length > 1) {
          ctx.strokeStyle = '#3f51b5';
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          ctx.moveTo(transformX(path.points[0].x), transformY(path.points[0].y));
          
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(transformX(path.points[i].x), transformY(path.points[i].y));
          }
          
          ctx.stroke();
          
          // Draw points along the path
          ctx.fillStyle = '#3f51b5';
          path.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(transformX(point.x), transformY(point.y), 3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
    }
    
    // Draw robot position
    const robotX = transformX(robotPosition.x);
    const robotY = transformY(robotPosition.y);
    
    // Draw robot
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(robotX, robotY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw robot orientation line
    const angle = (robotPosition.orientation * Math.PI) / 180;
    const orientationLength = 15;
    
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(robotX, robotY);
    ctx.lineTo(
      robotX + Math.cos(angle) * orientationLength,
      robotY - Math.sin(angle) * orientationLength
    );
    ctx.stroke();
    
    // Draw proximity sensors if available (visualization based on proximity data)
    if (sensorData.proximity && sensorData.proximity.length > 0) {
      ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
      ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
      
      const sensorAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]; // Assuming 4 sensors
      
      sensorData.proximity.forEach((proximity, index) => {
        if (index < sensorAngles.length) {
          const sensorAngle = angle + sensorAngles[index];
          const sensorRange = proximity * scale * 20; // Scale up for visibility
          
          ctx.beginPath();
          ctx.moveTo(robotX, robotY);
          ctx.lineTo(
            robotX + Math.cos(sensorAngle) * sensorRange,
            robotY - Math.sin(sensorAngle) * sensorRange
          );
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(
            robotX + Math.cos(sensorAngle) * sensorRange,
            robotY - Math.sin(sensorAngle) * sensorRange,
            2, 0, Math.PI * 2
          );
          ctx.fill();
        }
      });
    }
    
  }, [robotPosition, sensorData, mapData]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={600} 
      className="w-full h-full bg-white rounded-md"
    />
  );
}