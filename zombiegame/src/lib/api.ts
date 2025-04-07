import { apiRequest } from './queryClient';

// Game player API
export async function getGamePlayer() {
  return apiRequest('/api/game/player');
}

export async function updateGamePlayer(updates: any) {
  return apiRequest('/api/game/player', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

// Game items API
export async function getGameItems() {
  return apiRequest('/api/game/items');
}

export async function collectGameItem(itemId: number) {
  return apiRequest(`/api/game/items/${itemId}/collect`, {
    method: 'POST',
  });
}

// Game zombies API
export async function getGameZombies() {
  return apiRequest('/api/game/zombies');
}

// WebSocket connection (for real-time game updates)
let socket: WebSocket | null = null;

export function connectToGameServer(onMessage: (data: any) => void, onClose: () => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/game`;
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('Connected to game server');
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('Disconnected from game server');
    onClose();
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return socket;
}

export function disconnectFromGameServer() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
    socket = null;
  }
}

export function sendGameAction(action: string, data: any = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action,
      data,
    }));
  } else {
    console.error('Cannot send game action: WebSocket is not connected');
  }
}