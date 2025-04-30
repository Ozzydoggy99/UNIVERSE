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
      muxerRef.current.destroy();
      muxerRef.current = null;
    }

    // Clean up any previous socket connection
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    let isComponentMounted = true;

    const initializeVideoStream = () => {
      if (!videoRef.current || !isComponentMounted) return;

      try {
        // Initialize JMuxer
        muxerRef.current = new JMuxer({
          node: videoRef.current,
          mode: 'video',
          fps: 30,
          flushingTime: 33, // ~30fps
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
          console.log('H264 WebSocket connected');
          setIsLoading(false);
        };

        socket.onmessage = (event) => {
          if (!muxerRef.current || !isComponentMounted) return;
          
          try {
            // Check if the response is a JSON error message
            if (typeof event.data === 'string') {
              try {
                const jsonResponse = JSON.parse(event.data);
                if (jsonResponse.error) {
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
              
              muxerRef.current.feed({
                video: videoData
              });
            }
          } catch (err) {
            console.error('Error processing video frame:', err);
          }
        };

        socket.onerror = (error) => {
          console.error('H264 WebSocket error:', error);
          setError('Connection error occurred. Attempting to reconnect...');
          
          if (isComponentMounted) {
            setReconnectCount(prev => prev + 1);
          }
        };

        socket.onclose = () => {
          console.warn('WebSocket disconnected - attempting to reconnect...');
          
          if (isComponentMounted) {
            // Get appropriate backoff delay based on reconnect count
            const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000);
            
            // Attempt reconnection after a delay with exponential backoff
            setTimeout(() => {
              if (isComponentMounted && reconnectCount < 5) {
                console.log(`Attempting to reconnect to video stream (attempt ${reconnectCount + 1}/5)...`);
                setReconnectCount(prevCount => prevCount + 1);
                initializeVideoStream();
              } else if (isComponentMounted) {
                setError('Failed to connect to video stream after multiple attempts. Will try again in 30 seconds.');
                setIsLoading(false);
                
                // Final retry attempt after a longer delay
                setTimeout(() => {
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
          }
        };
      } catch (err) {
        console.error('Error initializing video stream:', err);
        
        if (isComponentMounted) {
          setError(`Failed to initialize video stream: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      }
    };

    initializeVideoStream();

    // Clean up when the component unmounts
    return () => {
      isComponentMounted = false;
      
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      if (muxerRef.current) {
        muxerRef.current.destroy();
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