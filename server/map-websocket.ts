/**
 * Map WebSocket Server
 * 
 * Handles real-time map and point updates via WebSocket.
 */

import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { mapSyncEvents } from './map-sync-service';

let wss: WebSocketServer | null = null;

/**
 * Set up the WebSocket server for map updates
 */
export function setupMapWebSocketServer(server: Server) {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/maps'
  });

  // Handle new connections
  wss.on('connection', (ws) => {
    console.log('[MAP-WS] New client connected');
    
    // Send initial map data
    const { getCurrentMapData } = require('./map-sync-service');
    const mapData = getCurrentMapData();
    ws.send(JSON.stringify({
      type: 'initial_data',
      data: mapData
    }));
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
          case 'subscribe':
            // Client can subscribe to specific events
            if (data.events) {
              ws.subscribedEvents = new Set(data.events);
            }
            break;
            
          default:
            console.log('[MAP-WS] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('[MAP-WS] Error processing message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('[MAP-WS] Client disconnected');
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('[MAP-WS] WebSocket error:', error);
    });
  });
  
  // Set up event listeners for map/point changes
  mapSyncEvents.on('mapsChanged', (changes) => {
    broadcastToClients({
      type: 'maps_changed',
      data: changes
    });
  });
  
  mapSyncEvents.on('pointsChanged', (data) => {
    broadcastToClients({
      type: 'points_changed',
      data
    });
  });
  
  console.log('[MAP-WS] Map WebSocket server initialized');
}

/**
 * Broadcast a message to all connected clients
 */
function broadcastToClients(message: any) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      // Check if client has subscribed to this event type
      if (!client.subscribedEvents || client.subscribedEvents.has(message.type)) {
        client.send(messageStr);
      }
    }
  });
}

/**
 * Get the number of connected clients
 */
export function getConnectedClientsCount(): number {
  return wss ? wss.clients.size : 0;
} 