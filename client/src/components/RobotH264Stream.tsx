import React, { useEffect, useRef, useState } from 'react';
import JMuxer from 'jmuxer';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface RobotH264StreamProps {
  serialNumber?: string;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function RobotH264Stream({ 
  serialNumber, 
  width = '100%', 
  height = 'auto',
  className = ''
}: RobotH264StreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const muxerRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    if (!serialNumber) {
      setError('No robot serial number provided');
      setIsLoading(false);
      return;
    }

    // Clean up any previous muxer instance
    if (muxerRef.current) {
      try {
        muxerRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying previous JMuxer instance:', e);
      }
      muxerRef.current = null;
    }

    // Clean up any previous socket connection
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn('Error closing previous WebSocket connection:', e);
      }
      socketRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    let isComponentMounted = true;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let frameCount = 0;
    let lastFrameTime = Date.now();
    let framesSinceLastReport = 0;

    const initializeVideoStream = () => {
      if (!videoRef.current || !isComponentMounted) return;

      try {
        // Initialize JMuxer with improved settings
        muxerRef.current = new JMuxer({
          node: videoRef.current,
          mode: 'video',
          fps: 24, // Lower fps for better stability
          flushingTime: 41, // ~24fps
          debug: false,
          clearBuffer: true
        });

        // Set up WebSocket for video streaming
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/robot-video/${serialNumber}`;
        
        console.log(`Connecting to H264 video stream at: ${wsUrl}`);
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
          console.log('H264 WebSocket connected successfully');
          if (isComponentMounted) {
            setIsLoading(false);
            setError(null);
            
            // Reset counters on successful connection
            frameCount = 0;
            lastFrameTime = Date.now();
            framesSinceLastReport = 0;
          }
        };

        socket.onmessage = (event) => {
          if (!muxerRef.current || !isComponentMounted) return;
          
          try {
            // Check if the response is a JSON error message
            if (typeof event.data === 'string') {
              try {
                const jsonResponse = JSON.parse(event.data);
                if (jsonResponse.error) {
                  console.warn('Video stream error:', jsonResponse.error);
                  setError(jsonResponse.error);
                  setIsLoading(false);
                }
                return;
              } catch (e) {
                // Not JSON, continue as binary
              }
            }
            
            // Process binary data
            if (event.data instanceof ArrayBuffer) {
              const videoData = new Uint8Array(event.data);
              
              // Skip empty frames
              if (videoData.length === 0) return;
              
              // Feed data to the muxer
              muxerRef.current.feed({
                video: videoData
              });
              
              // Update frame statistics
              frameCount++;
              framesSinceLastReport++;
              
              // Log frame rate every 100 frames
              const now = Date.now();
              if (framesSinceLastReport >= 100) {
                const elapsed = now - lastFrameTime;
                const fps = framesSinceLastReport / (elapsed / 1000);
                console.log(`Video stream running at ~${fps.toFixed(1)} fps`);
                
                framesSinceLastReport = 0;
                lastFrameTime = now;
              }
            }
          } catch (err) {
            console.error('Error processing video frame:', err);
          }
        };

        socket.onerror = (error) => {
          console.error('H264 WebSocket error:', error);
          
          if (isComponentMounted) {
            setError('Connection error occurred. Attempting to reconnect...');
            setReconnectCount(prev => prev + 1);
          }
        };

        socket.onclose = (event) => {
          console.warn(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'}) - attempting to reconnect...`);
          
          if (!isComponentMounted) return;
          
          // Clear any existing timeout
          if (reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
          }
          
          // Calculate backoff delay with a gentler curve (1.5 instead of 2)
          const delay = Math.min(1000 * Math.pow(1.5, reconnectCount), 30000);
          
          // Attempt reconnection with exponential backoff
          reconnectTimeoutId = setTimeout(() => {
            reconnectTimeoutId = null;
            
            if (!isComponentMounted) return;
            
            if (reconnectCount < 5) {
              console.log(`Attempting to reconnect to video stream (attempt ${reconnectCount + 1}/5)...`);
              setReconnectCount(prevCount => prevCount + 1);
              initializeVideoStream();
            } else {
              console.warn('Maximum reconnection attempts reached, will try again in 30 seconds');
              setError('Failed to connect to robot after multiple attempts. Will try again soon.');
              setIsLoading(false);
              
              // Final retry attempt after a longer delay
              reconnectTimeoutId = setTimeout(() => {
                reconnectTimeoutId = null;
                
                if (isComponentMounted) {
                  console.log('Making final video stream connection attempt...');
                  setReconnectCount(0);
                  setError(null);
                  setIsLoading(true);
                  initializeVideoStream();
                }
              }, 30000);
            }
          }, delay);
        };
      } catch (err) {
        console.error('Error initializing video stream:', err);
        
        if (isComponentMounted) {
          setError(`Failed to initialize video stream: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      }
    };

    // Start the initialization process
    initializeVideoStream();

    // Clean up when the component unmounts
    return () => {
      isComponentMounted = false;
      
      // Clear any pending timeouts
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      
      // Close and cleanup WebSocket
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {
          console.warn('Error closing socket during cleanup:', e);
        }
        socketRef.current = null;
      }
      
      // Destroy JMuxer instance
      if (muxerRef.current) {
        try {
          muxerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying JMuxer during cleanup:', e);
        }
        muxerRef.current = null;
      }
    };
  }, [serialNumber, reconnectCount]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Connecting to robot camera...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 p-4">
            <p className="text-destructive font-medium mb-2">Error connecting to camera</p>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </div>
        )}
        
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          muted
          style={{ width, height, display: isLoading || error ? 'none' : 'block' }}
        />
      </CardContent>
    </Card>
  );
}

export default RobotH264Stream;