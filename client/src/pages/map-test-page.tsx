import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Bot, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRobot } from '@/providers/robot-provider';
import { Map, MapData } from '@/components/ui/map-fixed';
import { MapEnhanced } from '@/components/ui/map-enhanced';
import { Base64ImageTest } from '@/components/ui/base64-image-test';
import { ConnectionStatus } from '@/components/robot/ConnectionStatus';
import ConnectionErrorMessage from '@/components/robot/ConnectionErrorMessage';

// Create interfaces for our data
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

export default function MapTestPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const serialNumber = params.serialNumber || 'L382502104987ir'; // Default robot serial
  
  // Get robot WebSocket state from context
  const { connectionState, connectWebSocket, disconnectWebSocket, isConnected, refreshData } = useRobot();

  // Fetch robot status
  const { data: robotStatus, isLoading: statusLoading } = useQuery<RobotStatus>({
    queryKey: ['/api/robots/status', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch robot position
  const { data: robotPosition, isLoading: positionLoading } = useQuery<RobotPosition>({
    queryKey: ['/api/robots/position', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch robot sensor data
  const { data: sensorData, isLoading: sensorLoading } = useQuery<RobotSensorData>({
    queryKey: ['/api/robots/sensors', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Using the MapData type imported from map-fixed.tsx
  
  // Fetch map data
  const { data: mapData, isLoading: mapLoading } = useQuery<MapData>({
    queryKey: ['/api/robots/map', serialNumber],
    enabled: !!serialNumber,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Handle back button click
  const handleBack = () => {
    navigate('/robot-hub');
  };

  // Check if data is still loading
  const isLoading = statusLoading || positionLoading || sensorLoading || mapLoading;

  // Only use real data from the robot
  const status = robotStatus || {
    model: 'Unknown',
    serialNumber: serialNumber || 'Unknown',
    battery: 0,
    status: 'unknown',
    mode: 'unknown',
    lastUpdate: new Date().toISOString()
  };
  
  // Make sure position data has safe default values and is non-null
  const position = robotPosition ? {
    x: typeof robotPosition.x === 'number' ? robotPosition.x : 0,
    y: typeof robotPosition.y === 'number' ? robotPosition.y : 0,
    z: typeof robotPosition.z === 'number' ? robotPosition.z : 0,
    orientation: typeof robotPosition.orientation === 'number' ? robotPosition.orientation : 0,
    speed: typeof robotPosition.speed === 'number' ? robotPosition.speed : 0,
    timestamp: robotPosition.timestamp || new Date().toISOString()
  } : {
    x: 0,
    y: 0,
    z: 0,
    orientation: 0,
    speed: 0,
    timestamp: new Date().toISOString()
  };
  
  // Make sure sensor data has safe defaults
  const sensors = sensorData ? {
    temperature: typeof sensorData.temperature === 'number' ? sensorData.temperature : 0,
    voltage: typeof sensorData.voltage === 'number' ? sensorData.voltage : 0,
    current: typeof sensorData.current === 'number' ? sensorData.current : 0,
    battery: typeof sensorData.battery === 'number' ? sensorData.battery : 0,
    power_supply_status: sensorData.power_supply_status || 'unknown',
    charging: !!sensorData.charging,
    connectionStatus: sensorData.connectionStatus || 'disconnected',
    humidity: typeof sensorData.humidity === 'number' ? sensorData.humidity : 0,
    proximity: Array.isArray(sensorData.proximity) ? sensorData.proximity : [],
    timestamp: sensorData.timestamp || new Date().toISOString()
  } : {
    temperature: 0,
    voltage: 0,
    current: 0,
    battery: 0,
    power_supply_status: 'unknown',
    charging: false,
    connectionStatus: 'disconnected',
    humidity: 0,
    proximity: [],
    timestamp: new Date().toISOString()
  };
  
  // Make sure map data has safe defaults and proper typing
  const mapDataToUse: MapData = mapData ? {
    grid: mapData.grid || [],
    obstacles: mapData.obstacles || [],
    paths: mapData.paths || [],
    size: (mapData.size || [0, 0]) as [number, number],
    resolution: typeof mapData.resolution === 'number' ? mapData.resolution : 0.05,
    origin: (mapData.origin || [0, 0]) as [number, number],
    stamp: typeof mapData.stamp === 'number' ? mapData.stamp : 0
  } : {
    grid: [],
    obstacles: [],
    paths: [],
    size: [0, 0] as [number, number],
    resolution: 0.05,
    origin: [0, 0] as [number, number],
    stamp: 0
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Robot Hub
        </Button>
        
        <Button 
          variant="primary"
          className="bg-primary text-white hover:bg-primary/90"
          onClick={() => navigate(`/robot-details/${serialNumber}`)}
        >
          <Bot className="h-4 w-4 mr-2" />
          Back to Robot Details
        </Button>
      </div>
      
      {/* Add connection components */}
      <ConnectionStatus />
      <ConnectionErrorMessage />

      <div className="flex flex-col gap-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Enhanced Map Test Page</CardTitle>
            <CardDescription>Testing the enhanced map component with real robot data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-medium">{status.serialNumber}</span>
              </div>
              <Badge variant="outline">{status.status}</Badge>
            </div>
            
            <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
              <div className="border rounded p-2">
                <span className="block text-muted-foreground">Position</span>
                <span className="font-mono">x: {position.x.toFixed(4)}</span>,{' '}
                <span className="font-mono">y: {position.y.toFixed(4)}</span>
              </div>
              <div className="border rounded p-2">
                <span className="block text-muted-foreground">Orientation</span>
                <span className="font-mono">{position.orientation.toFixed(2)}°</span>
              </div>
              <div className="border rounded p-2">
                <span className="block text-muted-foreground">Battery</span>
                <span className="font-mono">{sensors.battery}%</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="h-[600px] border rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-pulse">Loading map data...</div>
                  </div>
                ) : (
                  <MapEnhanced
                    robotStatus={status}
                    robotPosition={position}
                    sensorData={sensors}
                    mapData={{
                      ...mapDataToUse,
                      // Add additional fields required by MapEnhanced
                      waypoints: [],
                      pickupPoints: [],
                      dropoffPoints: [],
                      mapId: "1",
                      connectionStatus: 'connected'
                    }}
                    editable={true}
                    onMapUpdate={(updatedMap) => {
                      console.log('Map updated', updatedMap);
                      refreshData();
                    }}
                    availableMaps={[
                      { id: "1", name: "Current Map" }
                    ]}
                    onMapChange={(mapId) => {
                      console.log('Map changed to', mapId);
                      refreshData();
                    }}
                  />
                )}
              </div>
              
              {/* Add direct base64 image rendering test */}
              <div className="h-[600px] overflow-auto">
                <div className="h-full">
                  {/* Import and use the Base64 test component */}
                  <Base64ImageTest serialNumber={serialNumber} />
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-sm">
              <h3 className="font-medium mb-2">Map Data Details</h3>
              <pre className="bg-slate-100 p-2 rounded-md overflow-x-auto">
                {JSON.stringify({
                  resolution: mapDataToUse.resolution,
                  size: mapDataToUse.size,
                  origin: mapDataToUse.origin,
                  stamp: mapDataToUse.stamp,
                  gridType: typeof mapDataToUse.grid,
                  gridLength: typeof mapDataToUse.grid === 'string' ? mapDataToUse.grid.length : 0,
                  hasGrid: Boolean(mapDataToUse.grid && 
                    ((typeof mapDataToUse.grid === 'string' && mapDataToUse.grid.length > 0) || 
                    (Array.isArray(mapDataToUse.grid) && mapDataToUse.grid.length > 0))),
                  gridDataStart: typeof mapDataToUse.grid === 'string' ? mapDataToUse.grid.substring(0, 20) + '...' : '',
                  robotPosition: {
                    x: position.x,
                    y: position.y, 
                    orientation: position.orientation
                  }
                }, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}