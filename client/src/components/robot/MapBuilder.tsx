import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  Map as MapIcon, 
  Save, 
  Play, 
  Square, 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DirectionalControl } from './DirectionalControl';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { robotWebSocket, startMappingStreams, stopMappingStreams } from '@/lib/robotWebSocket';
import { RobotUpdateEvent } from '@/lib/robotWebSocket';

const MAP_BUILDING_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  BUILDING: 'building',
  PROCESSING: 'processing',
  SAVING: 'saving',
  COMPLETED: 'completed',
  ERROR: 'error'
};

interface MapBuilderProps {
  serialNumber: string;
  onMapBuilt?: (mapId: string) => void;
}

export default function MapBuilder({ serialNumber, onMapBuilt }: MapBuilderProps) {
  const [mapStatus, setMapStatus] = useState(MAP_BUILDING_STATUS.IDLE);
  const [mapProgress, setMapProgress] = useState(0);
  const [mapName, setMapName] = useState(`New Map ${new Date().toLocaleDateString()}`);
  const [mappingSessionId, setMappingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realTimeMapData, setRealTimeMapData] = useState<any>(null);
  const [isConnectedToMapStream, setIsConnectedToMapStream] = useState<boolean>(false);
  const [currentRobotPosition, setCurrentRobotPosition] = useState<any>(null);
  const [positionData, setPositionData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const websocketListenerRef = useRef<((event: RobotUpdateEvent) => void) | null>(null);
  
  // Get current map data (LiDAR and position) to display while mapping
  const { data: lidarData } = useQuery({
    queryKey: ['/api/robots/lidar', serialNumber],
    refetchInterval: mapStatus === MAP_BUILDING_STATUS.BUILDING ? 1000 : false,
    enabled: !!serialNumber && mapStatus === MAP_BUILDING_STATUS.BUILDING
  });
  
  // We now manage position data through state from WebSocket
  
  // Get the current map being built
  const { data: currentMapData, refetch: refetchMapData } = useQuery({
    queryKey: ['/api/robots/current-map', serialNumber, mappingSessionId],
    refetchInterval: mapStatus === MAP_BUILDING_STATUS.BUILDING ? 2000 : false,
    enabled: !!serialNumber && !!mappingSessionId && mapStatus === MAP_BUILDING_STATUS.BUILDING
  });
  
  // WebSocket integration for real-time map updates during building
  useEffect(() => {
    // Only setup the WebSocket when we're actively building a map
    if (mapStatus === MAP_BUILDING_STATUS.BUILDING && serialNumber) {
      console.log('Setting up WebSocket for real-time map building visualization');
      
      // Define the WebSocket event handler
      const handleRobotWebSocketUpdate = (event: RobotUpdateEvent) => {
        if (event.type === 'map') {
          console.log('Received real-time map update via WebSocket:', event.data);
          // Only update if we have grid data
          if (event.data?.grid) {
            console.log('Real-time map data contains grid information, updating visualization');
            setRealTimeMapData(event.data);
            setIsConnectedToMapStream(true);
          } else {
            console.log('Map data received but no grid information present');
          }
        } else if (event.type === 'position') {
          // Update robot position during mapping for real-time tracking
          console.log('Received position update via WebSocket:', event.data);
          setCurrentRobotPosition(event.data);
          setPositionData(event.data); // Also update the position for map display
        } else if (event.type === 'connection') {
          console.log('WebSocket connection state changed:', event.state);
          setIsConnectedToMapStream(event.state === 'connected');
          
          // If we're now connected, explicitly request map data
          if (event.state === 'connected') {
            console.log('WebSocket connected, requesting map data with force update');
            robotWebSocket.requestMapData(serialNumber, true); // Force update to get latest map
            refetchMapData();
          }
        } else if (event.type === 'error') {
          console.error('WebSocket error during mapping:', event.message);
          
          // Show error toast
          toast({
            title: "Mapping Error",
            description: `Error during map creation: ${event.message}`,
            variant: "destructive"
          });
        }
      };
      
      // Store the handler in a ref so we can remove it later
      websocketListenerRef.current = handleRobotWebSocketUpdate;
      
      // Clear any existing subscription to avoid duplicates
      if (websocketListenerRef.current) {
        robotWebSocket.unsubscribe(websocketListenerRef.current);
      }
      
      // Ensure WebSocket is connected
      if (!robotWebSocket.isConnected()) {
        console.log('WebSocket not connected, connecting now...');
        robotWebSocket.connect();
      }
      
      // Subscribe to robot WebSocket updates
      robotWebSocket.subscribe(handleRobotWebSocketUpdate);
      
      // Start the mapping streams with specialized topics for real-time mapping
      console.log(`Starting real-time mapping streams for robot ${serialNumber}`);
      const enabledTopics = startMappingStreams(serialNumber);
      console.log('Enabled mapping topics:', enabledTopics);
      
      // Request initial data
      console.log('Requesting initial position and map data via WebSocket');
      robotWebSocket.requestPosition(serialNumber);
      robotWebSocket.requestMapData(serialNumber);
      
      // Also fetch via REST API for redundancy
      refetchMapData();
      
      // Set up polling fallback for map data if WebSocket doesn't deliver
      const pollingInterval = setInterval(() => {
        if (!isConnectedToMapStream || !realTimeMapData?.grid) {
          console.log('Map stream not active, polling for map updates via REST API');
          refetchMapData();
        }
      }, 3000); // Poll every 3 seconds
      
      // When this effect cleans up, unsubscribe from the WebSocket
      return () => {
        console.log('Cleaning up WebSocket for map building');
        if (websocketListenerRef.current) {
          robotWebSocket.unsubscribe(websocketListenerRef.current);
          websocketListenerRef.current = null;
        }
        
        // Stop the mapping streams
        console.log(`Stopping real-time mapping streams for robot ${serialNumber}`);
        stopMappingStreams(serialNumber);
        
        // Clear polling interval
        clearInterval(pollingInterval);
      };
    }
  }, [mapStatus, serialNumber, isConnectedToMapStream]);
  
  // Update the map canvas when data changes - prioritize real-time data if available
  useEffect(() => {
    if (canvasRef.current) {
      if (realTimeMapData?.grid) {
        // Use real-time WebSocket data if available
        console.log('Drawing map from real-time WebSocket data');
        drawMapOnCanvas(realTimeMapData);
      } else if (currentMapData?.grid) {
        // Fall back to REST API data if WebSocket data not available
        console.log('Drawing map from REST API data');
        drawMapOnCanvas(currentMapData);
      } else if (mapStatus === MAP_BUILDING_STATUS.BUILDING) {
        // If we're building a map but don't have data yet, request it explicitly
        console.log('No map data available yet, requesting from server...');
        if (serialNumber) {
          robotWebSocket.requestMapData(serialNumber);
          refetchMapData();
        }
      }
    }
  }, [realTimeMapData, currentMapData, mapStatus, serialNumber, canvasRef.current]);
  
  // Simulate progress update
  useEffect(() => {
    if (mapStatus === MAP_BUILDING_STATUS.BUILDING) {
      intervalRef.current = setInterval(() => {
        setMapProgress(prev => {
          const newProgress = prev + (Math.random() * 0.5);
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 3000);
    } else if (mapStatus === MAP_BUILDING_STATUS.PROCESSING) {
      setMapProgress(96);
      
      intervalRef.current = setInterval(() => {
        setMapProgress(prev => {
          const newProgress = prev + (Math.random() * 0.5);
          return newProgress > 99 ? 99 : newProgress;
        });
      }, 1000);
    } else if (mapStatus === MAP_BUILDING_STATUS.SAVING) {
      setMapProgress(99.5);
    } else if (mapStatus === MAP_BUILDING_STATUS.COMPLETED) {
      setMapProgress(100);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mapStatus]);
  
  // Function to draw map data on canvas
  const drawMapOnCanvas = (mapData: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData?.grid) return;
    
    console.log('Drawing map with size:', mapData.size, 'resolution:', mapData.resolution);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get visualization hints if available
    const visualHints = mapData.visualizationHints || {
      dataType: 'occupancy_grid',
      wallColor: '#000000',
      freeSpaceColor: '#ffffff',
      unknownColor: '#888888'
    };
    
    // Draw the map grid - check data type to apply processing
    const imgData = new Image();
    
    // Set up image loading event
    imgData.onload = () => {
      // Set canvas size to match the image
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      
      // First, draw the base image
      ctx.drawImage(imgData, 0, 0);
      
      // Apply color enhancements for better visualization if requested
      if (visualHints.enhanceVisualization) {
        try {
          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process each pixel to enhance walls and free space
          for (let i = 0; i < data.length; i += 4) {
            // Detect walls (dark pixels) and make them more visible
            if (data[i] < 50 && data[i+1] < 50 && data[i+2] < 50) {
              // Make walls blue for better visibility
              data[i] = 0;     // R
              data[i+1] = 0;   // G
              data[i+2] = 255; // B
              data[i+3] = 255; // A
            } 
            // Enhance free space (light pixels)
            else if (data[i] > 200 && data[i+1] > 200 && data[i+2] > 200) {
              // Make free space bright white
              data[i] = 255;   // R
              data[i+1] = 255; // G
              data[i+2] = 255; // B
              data[i+3] = 255; // A
            }
          }
          
          // Put the processed image data back
          ctx.putImageData(imageData, 0, 0);
          
          console.log('Map visualization enhanced for better wall visibility');
        } catch (err) {
          console.error('Error enhancing map visualization:', err);
        }
      }
      
      // Draw position quality indicator if available
      if (visualHints.showPositionQuality && mapData.position_quality !== undefined) {
        const quality = mapData.position_quality;
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = quality > 0.7 ? 'green' : quality > 0.4 ? 'orange' : 'red';
        ctx.fillText(`Position Quality: ${Math.round(quality * 100)}%`, 10, 30);
      }
      
      // Draw reliability indicator if available
      if (mapData.reliable !== undefined) {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = mapData.reliable ? 'green' : 'red';
        ctx.fillText(`Map Reliable: ${mapData.reliable ? 'Yes' : 'No'}`, 10, 60);
      }
      
      // Draw data source if available
      if (mapData.source) {
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText(`Source: ${mapData.source}`, 10, canvas.height - 10);
      }
      
      // Draw robot position if available
      if (positionData) {
        const scale = mapData.resolution;
        const originX = mapData.origin[0];
        const originY = mapData.origin[1];
        
        // Convert robot position to pixel coordinates
        const robotX = (positionData.x - originX) / scale;
        const robotY = canvas.height - (positionData.y - originY) / scale;
        
        // Draw robot with improved visibility
        // First a larger halo for visibility
        ctx.beginPath();
        ctx.arc(robotX, robotY, 12, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // Yellow halo
        ctx.fill();
        
        // Then the robot position marker
        ctx.beginPath();
        ctx.arc(robotX, robotY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'red'; // Red center
        ctx.fill();
        
        // Draw robot orientation line with arrow
        const orientation = positionData.orientation || 0;
        const lineLength = 25;
        const endX = robotX + lineLength * Math.cos(orientation);
        const endY = robotY - lineLength * Math.sin(orientation);
        
        // Draw the direction line
        ctx.beginPath();
        ctx.moveTo(robotX, robotY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw arrowhead
        const arrowSize = 8;
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        // Calculate arrowhead points
        const arrowX1 = endX - arrowSize * Math.cos(orientation - arrowAngle);
        const arrowY1 = endY + arrowSize * Math.sin(orientation - arrowAngle);
        const arrowX2 = endX - arrowSize * Math.cos(orientation + arrowAngle);
        const arrowY2 = endY + arrowSize * Math.sin(orientation + arrowAngle);
        
        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(arrowX1, arrowY1);
        ctx.lineTo(arrowX2, arrowY2);
        ctx.closePath();
        ctx.fillStyle = 'blue';
        ctx.fill();
        
        // Display coordinates near the robot
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText(`(${positionData.x.toFixed(2)}, ${positionData.y.toFixed(2)})`, robotX + 15, robotY);
      }
    };
    
    // Handle image loading errors
    imgData.onerror = (err) => {
      console.error('Error loading map image:', err);
      
      // Draw a placeholder to show the error
      ctx.fillStyle = '#ffeeee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.font = '16px Arial';
      ctx.fillStyle = 'red';
      ctx.fillText('Error loading map image', 20, 50);
      
      // Show grid data info for debugging
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      ctx.fillText(`Grid data length: ${mapData.grid ? mapData.grid.length : 0}`, 20, 80);
      ctx.fillText(`Map size: ${mapData.size ? JSON.stringify(mapData.size) : 'undefined'}`, 20, 100);
    };
    
    // Set image source to the base64 encoded PNG
    try {
      // Add timestamp to prevent caching if map data has timestamp
      const cacheBuster = mapData.timestamp ? `?t=${new Date(mapData.timestamp).getTime()}` : '';
      imgData.src = `data:image/png;base64,${mapData.grid}${cacheBuster}`;
    } catch (err) {
      console.error('Error setting image source:', err);
    }
  };
  
  // Start building a new map
  const startMapBuilding = async () => {
    console.log("*** BUTTON CLICKED - START MAP BUILDING FUNCTION CALLED ***");
    console.log("*** MAP NAME:", mapName);
    console.log("*** SERIAL NUMBER:", serialNumber);

    try {
      console.log("*** SETTING MAPPING STATUS TO PREPARING ***");
      setMapStatus(MAP_BUILDING_STATUS.PREPARING);
      setError(null);
      setMapProgress(0);
      
      // Show a message to the user about what's happening
      toast({
        title: "Starting map creation",
        description: "Connecting to the physical robot to begin mapping...",
      });
      
      // First, check and stop any active mapping tasks on the robot
      // This prevents the "400 bad request - other mapping task id is running" error
      if (serialNumber) {
        console.log('Checking for active mapping tasks before starting a new one...');
        
        try {
          // Use our dedicated endpoint to stop any active mapping task
          const stopResponse = await apiRequest('POST', `/api/robots/stop-mapping/${serialNumber}`, {});
          console.log('Stop mapping response:', stopResponse);
        } catch (stopError) {
          // Log but don't throw - we still want to attempt to start the mapping
          console.warn('Error stopping active mapping task (non-critical):', stopError);
        }
      }
      
      // Notify user about the development mode override for connection status
      toast({
        title: "Development Mode",
        description: "Connection checks are bypassed in development mode to allow mapping to work.",
      });
      
      console.log(`Starting mapping with name: ${mapName} for robot: ${serialNumber}`);
      
      // Add a notification about mapping
      toast({
        title: "Starting mapping operation",
        description: "Connecting to robot to initialize mapping. This may take a moment.",
      });
      
      try {
        // Start a new mapping session
        console.log('Sending mapping request to server...');
        
        // Add better error handling for network errors
        let response;
        try {
          response = await fetch(`/api/robots/start-mapping/${serialNumber}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              mapName: mapName
            })
          });
        } catch (networkError) {
          console.error('Network error when connecting to server:', networkError);
          throw new Error('Network error: Could not connect to the server. Please check your connection.');
        }
        
        console.log('Start mapping API response status:', response.status, response.statusText);
        
        if (!response.ok) {
          // Handle specific error codes
          if (response.status === 502) {
            console.error('502 Bad Gateway Error - likely a connectivity issue with the robot');
            throw new Error('Unable to connect to the robot. Please check that the robot is powered on and connected to the network.');
          }
          
          let errorText = '';
          try {
            const errorData = await response.json();
            console.error('Start mapping error response:', errorData);
            errorText = errorData.error || `Server returned ${response.status} ${response.statusText}`;
          } catch (e) {
            try {
              errorText = await response.text();
              console.error('Start mapping raw error response:', errorText);
            } catch (textError) {
              console.error('Could not read error response body:', textError);
              errorText = `Server error: ${response.status} ${response.statusText}`;
            }
          }
          throw new Error(errorText || `Server returned ${response.status} ${response.statusText}`);
        }
        
        console.log('Response OK, parsing JSON...');
        let data = null;
        try {
          data = await response.json();
          console.log('Start mapping API response data:', data);
        } catch (jsonError) {
          console.error('Error parsing response JSON:', jsonError);
          throw new Error('Could not parse server response. Server may be experiencing issues.');
        }
        
        if (data.error) {
          console.error('Error in response data:', data.error);
          throw new Error(data.error);
        }
        
        if (!data.sessionId) {
          console.error('No session ID in response:', data);
          throw new Error('No session ID returned from server');
        }
        
        console.log(`Successfully received mapping session ID: ${data.sessionId}`);
        setMappingSessionId(data.sessionId);
        setMapStatus(MAP_BUILDING_STATUS.BUILDING);
        
        toast({
          title: "Map building started",
          description: "Drive the robot around to create a map of the environment.",
        });
      } catch (apiError: any) {
        console.error('API error when starting mapping:', apiError);
        throw apiError;
      }
    } catch (err: any) {
      console.error('Error in startMapBuilding:', err);
      setError(err.message || 'Failed to start mapping session');
      setMapStatus(MAP_BUILDING_STATUS.ERROR);
      
      toast({
        title: "Error starting map building",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
    }
  };
  
  // Save the current map
  const saveMap = async () => {
    if (!mappingSessionId) {
      toast({
        title: "Error saving map",
        description: "No active mapping session found",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setMapStatus(MAP_BUILDING_STATUS.SAVING);
      
      // Stop WebSocket mapping streams before saving the map
      console.log('Stopping mapping streams before saving map');
      stopMappingStreams(serialNumber);
      
      // Reset real-time map data
      setRealTimeMapData(null);
      setIsConnectedToMapStream(false);
      
      // Call API to finalize and save the map
      const response = await apiRequest('POST', `/api/robots/save-map/${serialNumber}`, {
        sessionId: mappingSessionId,
        mapName: mapName
      });
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setMapStatus(MAP_BUILDING_STATUS.COMPLETED);
      
      // Invalidate map-related queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ['/api/robots/map', serialNumber]
      });
      
      if (onMapBuilt) {
        onMapBuilt(data.mapId);
      }
      
      toast({
        title: "Map saved successfully",
        description: `Map "${mapName}" has been saved and is ready to use.`
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save map');
      setMapStatus(MAP_BUILDING_STATUS.ERROR);
      
      toast({
        title: "Error saving map",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
    }
  };
  
  // Cancel map building
  const cancelMapBuilding = async () => {
    if (!serialNumber) return;
    
    try {
      // First, try to stop any active mapping task on the robot
      console.log('Attempting to stop any active mapping task on the robot');
      
      try {
        // Use our new dedicated endpoint to stop any active mapping task
        const stopResponse = await apiRequest('POST', `/api/robots/stop-mapping/${serialNumber}`, {});
        console.log('Stop mapping response:', stopResponse);
      } catch (stopError) {
        // Log but don't throw - we still want to attempt the session-specific cancel
        console.error('Error stopping active mapping task:', stopError);
      }
      
      // Stop WebSocket mapping streams
      console.log('Stopping mapping streams');
      stopMappingStreams(serialNumber);
      
      // Reset real-time map data
      setRealTimeMapData(null);
      setIsConnectedToMapStream(false);
      
      // If we have a specific mapping session ID, also cancel it properly
      if (mappingSessionId) {
        console.log(`Cancelling specific mapping session with ID ${mappingSessionId}`);
        // Call API to cancel the specific mapping session
        await apiRequest('POST', `/api/robots/cancel-mapping/${serialNumber}`, {
          sessionId: mappingSessionId
        });
      }
      
      setMapStatus(MAP_BUILDING_STATUS.IDLE);
      setMappingSessionId(null);
      setMapProgress(0);
      
      toast({
        title: "Map building cancelled",
        description: "The mapping session has been cancelled."
      });
    } catch (err: any) {
      console.error('Error in cancelMapBuilding:', err);
      toast({
        title: "Error cancelling map building",
        description: err.message || 'Something went wrong',
        variant: "destructive"
      });
      
      // Even if there's an error, reset the UI state
      setMapStatus(MAP_BUILDING_STATUS.IDLE);
      setMappingSessionId(null);
      setMapProgress(0);
    }
  };
  
  // Reset the map builder
  const resetMapBuilder = async () => {
    try {
      // First, try to stop any active mapping task on the robot
      if (serialNumber) {
        console.log('Attempting to stop any active mapping task on the robot');
        
        try {
          // Use our new dedicated endpoint to stop any active mapping task
          const stopResponse = await apiRequest('POST', `/api/robots/stop-mapping/${serialNumber}`, {});
          console.log('Stop mapping response:', stopResponse);
        } catch (stopError) {
          // Log but don't throw - we still want to reset the UI
          console.error('Error stopping active mapping task:', stopError);
        }
      }
      
      // Stop any active mapping streams
      if (mapStatus === MAP_BUILDING_STATUS.BUILDING && serialNumber) {
        console.log('Stopping mapping streams before resetting map builder');
        stopMappingStreams(serialNumber);
      }
      
      // Reset all state
      setMapStatus(MAP_BUILDING_STATUS.IDLE);
      setMappingSessionId(null);
      setMapProgress(0);
      setError(null);
      setRealTimeMapData(null);
      setIsConnectedToMapStream(false);
      setMapName(`New Map ${new Date().toLocaleDateString()}`);
    } catch (error) {
      console.error('Error in resetMapBuilder:', error);
      
      // Even if there's an error, reset the UI state
      setMapStatus(MAP_BUILDING_STATUS.IDLE);
      setMappingSessionId(null);
      setMapProgress(0);
      setError(null);
      setRealTimeMapData(null);
      setIsConnectedToMapStream(false);
      setMapName(`New Map ${new Date().toLocaleDateString()}`);
    }
  };
  
  // Get status badge color
  const getStatusBadgeColor = () => {
    switch (mapStatus) {
      case MAP_BUILDING_STATUS.PREPARING:
      case MAP_BUILDING_STATUS.BUILDING:
        return 'bg-blue-500';
      case MAP_BUILDING_STATUS.PROCESSING:
      case MAP_BUILDING_STATUS.SAVING:
        return 'bg-amber-500';
      case MAP_BUILDING_STATUS.COMPLETED:
        return 'bg-green-500';
      case MAP_BUILDING_STATUS.ERROR:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Get user-friendly status text
  const getStatusText = () => {
    switch (mapStatus) {
      case MAP_BUILDING_STATUS.IDLE:
        return 'Ready to start';
      case MAP_BUILDING_STATUS.PREPARING:
        return 'Preparing...';
      case MAP_BUILDING_STATUS.BUILDING:
        return 'Building map...';
      case MAP_BUILDING_STATUS.PROCESSING:
        return 'Processing map data...';
      case MAP_BUILDING_STATUS.SAVING:
        return 'Saving map...';
      case MAP_BUILDING_STATUS.COMPLETED:
        return 'Map completed';
      case MAP_BUILDING_STATUS.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              Map Builder
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={getStatusBadgeColor()}>
                {getStatusText()}
              </Badge>
              {mapStatus === MAP_BUILDING_STATUS.IDLE && (
                <Button
                  onClick={startMapBuilding}
                  size="sm"
                  className="relative z-10"
                  disabled={!mapName}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Begin Mapping
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {mapStatus === MAP_BUILDING_STATUS.IDLE && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="map-name">Map Name</Label>
                <Input 
                  id="map-name" 
                  value={mapName} 
                  onChange={(e) => setMapName(e.target.value)} 
                  placeholder="Enter a name for your map"
                />
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-base mb-2">Map Building Instructions</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-primary font-bold mr-2">1.</span>
                        <span>Always start and end mapping from a charging station for proper localization.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary font-bold mr-2">2.</span>
                        <span>Drive the robot around to map the environment. Cover all accessible areas for best results.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-primary font-bold mr-2">3.</span>
                        <span>Return to the charging station before saving the map to ensure accurate alignment.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={startMapBuilding} 
                className="w-full flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Building Map
              </Button>
            </div>
          )}
          
          {mapStatus !== MAP_BUILDING_STATUS.IDLE && mapStatus !== MAP_BUILDING_STATUS.ERROR && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Building: {mapName}</span>
                  <span>{mapProgress.toFixed(1)}%</span>
                </div>
                <Progress value={mapProgress} className="h-2" />
              </div>
              
              {mapStatus === MAP_BUILDING_STATUS.BUILDING && (
                <div className="border rounded-md bg-gray-50 p-1 aspect-video relative overflow-hidden">
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-contain"
                  />
                  
                  {!currentMapData?.grid && !realTimeMapData?.grid && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-500">Waiting for map data...</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/80 rounded text-xs p-1">
                    <div className={`w-2 h-2 rounded-full ${isConnectedToMapStream ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{isConnectedToMapStream ? 'Real-time updates active' : 'Polling for updates'}</span>
                  </div>
                  
                  <div className="absolute bottom-2 right-2 bg-white/80 rounded text-xs p-1">
                    Drive the robot to build map
                  </div>
                </div>
              )}
              
              {mapStatus === MAP_BUILDING_STATUS.BUILDING && (
                <div className="flex flex-col space-y-4">
                  {/* Building instructions box */}
                  <div className="bg-gray-50 border rounded-md p-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Drive the robot around to all areas you want to map
                    </p>
                    <div className="text-xs font-medium text-amber-600 mb-3 bg-amber-50 p-2 rounded">
                      Remember to return to the charging station before saving
                    </div>
                    <div className="flex justify-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => refetchMapData()}
                        className="flex items-center gap-1"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Refresh Map
                      </Button>
                    </div>
                  </div>
                  
                  {/* Controls section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <DirectionalControl 
                        serialNumber={serialNumber} 
                        disabled={false} 
                        compact={true}
                      />
                    </div>
                    
                    <div className="flex flex-col justify-end">
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <Button 
                          onClick={saveMap} 
                          className="flex items-center gap-1"
                          variant="default"
                        >
                          <Save className="h-4 w-4" />
                          Save Map
                        </Button>
                        <Button 
                          onClick={cancelMapBuilding} 
                          className="flex items-center gap-1"
                          variant="outline"
                        >
                          <Square className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {(mapStatus === MAP_BUILDING_STATUS.PROCESSING || 
                mapStatus === MAP_BUILDING_STATUS.SAVING) && (
                <div className="text-center py-6">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p>
                    {mapStatus === MAP_BUILDING_STATUS.PROCESSING ? 
                      'Processing map data...' : 'Saving map...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a moment. Please do not refresh the page.
                  </p>
                </div>
              )}
              
              {mapStatus === MAP_BUILDING_STATUS.COMPLETED && (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium">Map Created Successfully!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your new map "{mapName}" is ready to use
                  </p>
                </div>
              )}
              
              {(mapStatus === MAP_BUILDING_STATUS.COMPLETED || 
               mapStatus === MAP_BUILDING_STATUS.PROCESSING || 
               mapStatus === MAP_BUILDING_STATUS.SAVING) && (
                <Button 
                  onClick={resetMapBuilder} 
                  className="w-full"
                  variant={mapStatus === MAP_BUILDING_STATUS.COMPLETED ? 'default' : 'outline'}
                  disabled={mapStatus !== MAP_BUILDING_STATUS.COMPLETED}
                >
                  {mapStatus === MAP_BUILDING_STATUS.COMPLETED ? 'Start a New Map' : 'Building Map...'}
                </Button>
              )}
            </div>
          )}
          
          {mapStatus === MAP_BUILDING_STATUS.ERROR && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Building Map</AlertTitle>
                <AlertDescription>
                  {error || 'Something went wrong while building the map.'}
                </AlertDescription>
              </Alert>

              {error && (error.toLowerCase().includes('502') || error.toLowerCase().includes('connect')) && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h5 className="font-medium text-sm mb-2">Troubleshooting Tips:</h5>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    <li>Verify the robot is powered on and connected to the network</li>
                    <li>Check that the robot's API service is running</li>
                    <li>Ensure your network connection is stable</li>
                    <li>Wait a moment and try again</li>
                  </ul>
                </div>
              )}
              
              <Button 
                onClick={resetMapBuilder} 
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}