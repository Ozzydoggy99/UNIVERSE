/**
 * Vite HMR WebSocket Fix
 * 
 * This module specifically targets Vite's HMR WebSocket connection issue
 * where the port is undefined, causing DOMException errors.
 * 
 * The fix adds a globally accessible fix function that's called by Vite's code.
 */

// Expose fix function to global scope so Vite's code can access it
declare global {
  interface Window {
    __fixViteWebSocketUrl: (url: string) => string;
  }
}

// Initialize the fix function
function initFix() {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Function to fix Vite's WebSocket URLs with undefined port
  window.__fixViteWebSocketUrl = (url: string): string => {
    if (!url) return url;
    
    // Check if this is a URL with undefined port
    if (url.includes('localhost:undefined') || url.includes('undefined/?token=')) {
      // Get the current window location port
      const currentPort = window.location.port || '80';
      console.log('Fixing Vite HMR WebSocket URL with port:', currentPort);
      
      // Fix the problematic parts of the URL
      return url
        .replace('localhost:undefined', `localhost:${currentPort}`)
        .replace('undefined/?token=', `${currentPort}/?token=`);
    }
    
    return url;
  };
  
  console.log('Vite HMR WebSocket fix initialized');
}

// Apply fix on module load
initFix();

export {};