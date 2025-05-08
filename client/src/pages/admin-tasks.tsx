// client/src/pages/admin-tasks.tsx
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface TaskStatus {
  taskId: string;
  status: string;
  timestamp: number;
}

export default function AdminTasksPage() {
  const [messages, setMessages] = useState<TaskStatus[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Use the current hostname, but with secure protocol for WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/status`);
    
    socket.onopen = () => {
      console.log('Connected to task status WebSocket');
      setConnected(true);
    };
    
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const newStatus: TaskStatus = {
          taskId: parsed?.taskId || parsed?.id || 'unknown',
          status: parsed?.status || parsed?.state || 'unknown',
          timestamp: Date.now()
        };
        setMessages(prev => [newStatus, ...prev.slice(0, 20)]);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    socket.onerror = (err) => {
      console.error('❌ WebSocket Error:', err);
      setConnected(false);
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    };
    
    return () => {
      console.log('Closing WebSocket connection');
      socket.close();
    };
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">📡 Task Status Stream</h1>
      
      <div className="mb-4 flex items-center">
        <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span>{connected ? 'Connected to status stream' : 'Disconnected from status stream'}</span>
      </div>
      
      {messages.length === 0 && (
        <Card className="p-4 text-center text-gray-500">
          Waiting for task status updates...
        </Card>
      )}
      
      {messages.map((msg, i) => (
        <Card key={i} className={`mb-2 p-4 ${
          msg.status === 'success' ? 'border-green-500' :
          msg.status === 'failed' ? 'border-red-500' :
          msg.status === 'running' ? 'border-blue-500' : ''
        }`}>
          <div><strong>Task ID:</strong> {msg.taskId}</div>
          <div>
            <strong>Status:</strong> 
            <span className={
              msg.status === 'success' ? 'text-green-600' :
              msg.status === 'failed' ? 'text-red-600' :
              msg.status === 'running' ? 'text-blue-600' : ''
            }> {msg.status}</span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </Card>
      ))}
    </div>
  );
}