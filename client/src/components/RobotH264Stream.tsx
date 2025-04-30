import { useEffect, useRef, useState } from 'react';
import JMuxer from 'jmuxer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface RobotH264StreamProps {
  serialNumber?: string;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const RobotH264Stream: React.FC<RobotH264StreamProps> = ({
  serialNumber = 'L382502104987ir',
  width = '100%',
  height = 'auto',
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const jmuxerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create JMuxer instance when component mounts
    if (!videoRef.current) return;

    try {
      // Initialize JMuxer
      jmuxerRef.current = new JMuxer({
        node: videoRef.current,
        mode: 'video',
        debug: true,
        flushingTime: 0,
        fps: 30,
        readFpsFromTrack: false,
      });

      // Setup video stream connection
      const setupStream = async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Determine if we're using WebSocket or HTTP for video
          const useWebsocket = true; // Set to false to try HTTP polling instead

          if (useWebsocket) {
            // WebSocket approach for streaming video
            // Convert http to ws or https to wss for the WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/api/robot-video/${serialNumber}`;
            
            console.log(`Connecting to robot video WebSocket at: ${wsUrl}`);
            
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';
            
            ws.onopen = () => {
              console.log('Robot video WebSocket connection established');
              setIsLoading(false);
            };
            
            ws.onmessage = (event) => {
              if (jmuxerRef.current && event.data) {
                try {
                  const data = new Uint8Array(event.data);
                  jmuxerRef.current.feed({
                    video: data
                  });
                } catch (e) {
                  console.error('Error processing video data:', e);
                }
              }
            };
            
            ws.onerror = (err) => {
              console.error('Robot video WebSocket error:', err);
              setError('WebSocket connection error');
              setIsLoading(false);
            };
            
            ws.onclose = () => {
              console.warn('Robot video WebSocket connection closed');
              setError('Connection closed - trying to reconnect...');
              
              // Try to reconnect after a delay
              setTimeout(() => {
                setupStream();
              }, 3000);
            };
            
            // Return cleanup function
            return () => {
              ws.close();
            };
          } else {
            // HTTP polling approach as fallback
            const pollInterval = setInterval(async () => {
              try {
                const response = await fetch(`/api/robot-video-frame/${serialNumber}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);
                
                if (jmuxerRef.current && data.length > 0) {
                  jmuxerRef.current.feed({
                    video: data
                  });
                }
                
                // After first successful frame, set loading to false
                setIsLoading(false);
              } catch (e) {
                console.error('Error fetching video frame:', e);
                setError(`Failed to get video: ${e instanceof Error ? e.message : String(e)}`);
                setIsLoading(false);
              }
            }, 100); // Poll every 100ms
            
            // Return cleanup function
            return () => {
              clearInterval(pollInterval);
            };
          }
        } catch (err) {
          console.error('Error setting up video stream:', err);
          setError(`Failed to setup stream: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
          return () => {}; // Return empty cleanup function
        }
      };

      // Start streaming
      const cleanupFn = setupStream();
      
      // Clean up function
      return () => {
        // Call the cleanup returned from setupStream
        if (typeof cleanupFn === 'function') {
          cleanupFn();
        }
        
        // Destroy JMuxer instance
        if (jmuxerRef.current) {
          try {
            jmuxerRef.current.destroy();
            jmuxerRef.current = null;
          } catch (e) {
            console.error('Error destroying JMuxer:', e);
          }
        }
      };
    } catch (err) {
      console.error('Error initializing JMuxer:', err);
      setError(`Failed to initialize player: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
      return () => {}; // Return empty cleanup function
    }
  }, [serialNumber]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Live Robot Camera</CardTitle>
        <CardDescription>
          H.264 video stream from robot {serialNumber}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Video player that JMuxer will use */}
          <video 
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width, height, display: (!isLoading && !error) ? 'block' : 'none' }}
            className="rounded-lg"
          />
          
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Connecting to camera...</span>
            </div>
          )}
          
          {/* Error state */}
          {!isLoading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="text-red-500 mb-2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p className="text-sm text-center text-gray-700">
                {error}
                <span className="block mt-1 text-xs">
                  The robot camera may be offline or not accessible from this network.
                </span>
              </p>
            </div>
          )}
          
          {/* Live indicator */}
          {!isLoading && !error && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              Live
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RobotH264Stream;