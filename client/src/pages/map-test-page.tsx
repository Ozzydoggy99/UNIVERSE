import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Bot, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRobot } from '@/providers/robot-provider';
import { Map } from '@/components/ui/map-fixed';
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

  // Define MapData type
  interface MapData {
    grid: any[];
    obstacles: { x: number; y: number; z: number }[];
    paths: {
      points: { x: number; y: number; z: number }[];
      status: string;
    }[];
    size?: [number, number];
    resolution?: number;
    origin?: [number, number];
    stamp?: number;
  }
  
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
  
  const position = robotPosition || {
    x: 0,
    y: 0,
    z: 0,
    orientation: 0,
    speed: 0,
    timestamp: new Date().toISOString()
  };
  
  const sensors = sensorData || {
    temperature: 0,
    voltage: 0,
    current: 0,
    battery: 0,
    power_supply_status: 'unknown',
    charging: false,
    connectionStatus: 'disconnected',
    timestamp: new Date().toISOString()
  };
  
  const mapDataToUse = mapData || {
    grid: [],
    obstacles: [],
    paths: [],
    size: [0, 0],
    resolution: 0.05,
    origin: [0, 0],
    stamp: 0
  };

  return (
    <div className="container mx-auto p-6">
      <Button variant="outline" className="mb-6" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Robot Hub
      </Button>
      
      {/* Add connection components */}
      <ConnectionStatus />
      <ConnectionErrorMessage />

      <div className="flex flex-col gap-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Map Test Page</CardTitle>
            <CardDescription>Testing the fixed map component with real robot data</CardDescription>
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
            
            <div className="h-[600px] border rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse">Loading map data...</div>
                </div>
              ) : (
                <Map
                  robotStatus={status}
                  robotPosition={position}
                  sensorData={sensors}
                  mapData={mapDataToUse}
                  editable={false}
                />
              )}
            </div>
            
            <div className="mt-4 text-sm">
              <h3 className="font-medium mb-2">Map Data Details</h3>
              <pre className="bg-slate-100 p-2 rounded-md overflow-x-auto">
                {JSON.stringify({
                  resolution: mapDataToUse.resolution,
                  size: mapDataToUse.size,
                  origin: mapDataToUse.origin,
                  stamp: mapDataToUse.stamp,
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