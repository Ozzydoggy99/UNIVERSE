// Place this at the root level of the client directory
// This is a simple script to fix Vite's WebSocket connection issues

(function() {
  // Store the original WebSocket constructor
  const OriginalWebSocket = WebSocket;
  
  // Replace the WebSocket constructor with our patched version
  WebSocket = function(url, protocols) {
    // Fix the URL if it contains the problematic pattern
    if (typeof url === 'string' && (url.includes('localhost:undefined') || url.includes('undefined/?token='))) {
      console.log('[SOCKET FIX] Fixing invalid WebSocket URL:', url);
      
      // Extract the current port from the location
      const port = window.location.port;
      
      // Replace the undefined port with the current port
      url = url.replace('localhost:undefined', `localhost:${port}`)
               .replace('undefined/?token=', `${port}/?token=`);
      
      console.log('[SOCKET FIX] Fixed URL:', url);
    }
    
    // Call the original WebSocket constructor with the fixed URL
    return new OriginalWebSocket(url, protocols);
  };
  
  // Copy properties from the original WebSocket constructor
  WebSocket.prototype = OriginalWebSocket.prototype;
  WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  WebSocket.OPEN = OriginalWebSocket.OPEN;
  WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  
  console.log('[SOCKET FIX] Vite WebSocket fix installed');
})();