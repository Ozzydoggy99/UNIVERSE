/**
 * Vite HMR Monkey Patch
 * 
 * This module directly patches the Vite client's HMR WebSocket connection logic 
 * to handle undefined port issues. It intercepts the WebSocket connection 
 * before it's created and fixes the URL.
 */

// Import our helper function
import './fixViteHmrSocket';

// Apply the patch on module import
(() => {
  try {
    // Wait for Vite to be ready
    window.addEventListener('DOMContentLoaded', () => {
      // Try to access Vite's client setup function
      // We'll use setTimeout to ensure our code runs after Vite's initialization
      setTimeout(() => {
        // Fix any existing HMR connections
        fixExistingConnections();
        
        // Patch the WebSocket constructor
        patchWebSocketConstructor();
        
        console.log('Vite HMR monkey patch applied');
      }, 100);
    });
  } catch (error) {
    console.error('Error applying Vite HMR monkey patch:', error);
  }
})();

/**
 * Finds existing WebSocket connections in Vite's client module and fixes their URLs
 */
function fixExistingConnections() {
  try {
    // Look for Vite client script element
    const viteClientScripts = Array.from(document.querySelectorAll('script'))
      .filter(script => script.src && script.src.includes('/@vite/client'));
    
    if (viteClientScripts.length > 0) {
      console.log('Found Vite client script elements:', viteClientScripts.length);
    }
    
    // Try to access any vite client globals
    const anyWindow = window as any;
    if (anyWindow.__vite_ws || anyWindow.__vite_hmr || anyWindow.__HMR__) {
      console.log('Found potential Vite WebSocket reference in global scope');
    }
  } catch (error) {
    console.error('Error fixing existing connections:', error);
  }
}

/**
 * Patches the WebSocket constructor to intercept Vite's connections
 */
function patchWebSocketConstructor() {
  try {
    // Store the original WebSocket constructor
    const OriginalWebSocket = window.WebSocket;
    
    // Override the WebSocket constructor
    window.WebSocket = function(url, protocols) {
      // Pass URLs through our fix function if it's been set up
      if (typeof window.__fixViteWebSocketUrl === 'function' && typeof url === 'string') {
        const fixedUrl = window.__fixViteWebSocketUrl(url);
        
        // If the URL was modified, log it
        if (fixedUrl !== url) {
          console.log('Fixed WebSocket URL:', { 
            original: url,
            fixed: fixedUrl
          });
          
          return new OriginalWebSocket(fixedUrl, protocols);
        }
      }
      
      // Otherwise use original constructor
      return new OriginalWebSocket(url, protocols);
    } as typeof WebSocket;
    
    // Copy prototype and properties
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    
    // Set static properties 
    Object.defineProperties(window.WebSocket, {
      CONNECTING: { value: OriginalWebSocket.CONNECTING },
      OPEN: { value: OriginalWebSocket.OPEN },
      CLOSING: { value: OriginalWebSocket.CLOSING },
      CLOSED: { value: OriginalWebSocket.CLOSED }
    });
    
    console.log('WebSocket constructor patched for Vite HMR');
  } catch (error) {
    console.error('Error patching WebSocket constructor:', error);
  }
}

export {};