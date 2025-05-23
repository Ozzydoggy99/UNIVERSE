/**
 * Vite WebSocket Fix
 * 
 * This module patches the Vite HMR WebSocket connection to handle undefined port issues
 * that cause DOMException errors in the browser.
 */

// Apply the fix on module import
(() => {
  try {
    // Ensure we only run this in the browser
    if (typeof window === 'undefined') return;
    
    // Store the original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;
    
    // Define our patched WebSocket constructor with proper types
    function PatchedWebSocket(
      url: string | URL, 
      protocols?: string | string[]
    ): WebSocket {
      // Check if this is a Vite HMR WebSocket connection with port issues
      if (typeof url === 'string') {
        let needsFix = false;
        let fixedUrl = url;
        
        // Identify all possible patterns that need fixing
        if (url.includes('localhost:undefined') || 
            url.includes('undefined/?token=') || 
            url.match(/wss?:\/\/localhost:undefined/) ||
            url.match(/wss?:\/\/.*:undefined\//) ||
            url.includes('://:undefined/')) {
          
          needsFix = true;
          console.log('Fixing Vite WebSocket URL with undefined port:', url);
          
          // Fix the URL by using the current window location's port and host
          const currentHost = window.location.hostname;
          const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
          
          // Handle various undefined port patterns
          fixedUrl = url
            .replace('localhost:undefined', `${currentHost}:${currentPort}`)
            .replace('undefined/?token=', `${currentPort}/?token=`)
            .replace(/\/\/([^:]+):undefined\//, `//$1:${currentPort}/`)
            .replace(/\/\/:undefined\//, `//${currentHost}:${currentPort}/`);
          
          console.log('Fixed WebSocket URL:', fixedUrl);
        }
        
        // If URL was fixed, use the fixed version
        if (needsFix) {
          return new OriginalWebSocket(fixedUrl, protocols);
        }
      }
      
      // For all other WebSocket connections, use the original constructor
      return new OriginalWebSocket(url, protocols);
    }
    
    // Create a constructor function with the right prototype
    const WebSocketProxy = PatchedWebSocket as unknown as typeof WebSocket;
    
    // Copy prototype
    WebSocketProxy.prototype = OriginalWebSocket.prototype;
    
    // Set static properties by using Object.defineProperties
    Object.defineProperties(WebSocketProxy, {
      CONNECTING: { value: OriginalWebSocket.CONNECTING },
      OPEN: { value: OriginalWebSocket.OPEN },
      CLOSING: { value: OriginalWebSocket.CLOSING },
      CLOSED: { value: OriginalWebSocket.CLOSED }
    });
    
    // Apply the patched WebSocket
    window.WebSocket = WebSocketProxy;
    
    console.log('Vite WebSocket fix applied');
  } catch (error) {
    console.error('Error applying Vite WebSocket fix:', error);
  }
})();

export {}; // Ensure this is treated as a module