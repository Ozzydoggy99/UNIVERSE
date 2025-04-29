import React, { useState, useEffect, useRef } from 'react';

interface LiveMjpegStreamProps {
  streamUrl: string;
  refreshInterval?: number; // milliseconds
  width?: string | number;
  height?: string | number;
  className?: string;
  title?: string;
}

/**
 * LiveMjpegStream component that auto-refreshes to maintain a live MJPEG feed
 * This avoids CORS issues with iframes and provides better compatibility
 */
export const LiveMjpegStream: React.FC<LiveMjpegStreamProps> = ({ 
  streamUrl,
  refreshInterval = 1000, // 1 second default
  width = '100%',
  height = '100%',
  className = '',
  title = 'Live Camera Feed'
}) => {
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const cachedUrl = useRef<string>(`${streamUrl}?t=${timestamp}`);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  
  useEffect(() => {
    // Function to refresh the stream by updating the timestamp
    const refreshStream = () => {
      const newTimestamp = Date.now();
      cachedUrl.current = `${streamUrl}?t=${newTimestamp}`;
      setTimestamp(newTimestamp);
    };
    
    // Set up interval to refresh the stream
    const interval = setInterval(refreshStream, refreshInterval);
    
    // Refresh immediately on mount or when stream URL changes
    refreshStream();
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [streamUrl, refreshInterval]);
  
  const handleImageLoad = () => {
    setLoading(false);
    setError(false);
  };
  
  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };
  
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* The key prop forces React to re-render the image when timestamp changes */}
      <img 
        src={cachedUrl.current}
        alt={title}
        className="w-full h-full object-contain"
        style={{ display: loading || error ? 'none' : 'block' }}
        key={timestamp} 
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
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
            Unable to load stream. The robot camera may be offline or not accessible from this network. 
            <span className="block mt-1 text-xs">
              Due to browser security restrictions, the camera feed at {streamUrl} cannot be directly accessed.
            </span>
          </p>
        </div>
      )}
      
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
        Live
      </div>
    </div>
  );
};

export default LiveMjpegStream;