// client/src/pages/my-template.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useRobotMapData } from '@/hooks/use-robot-map-data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShowerHead, Trash2, LogOut, AlertCircle, BatteryMedium } from 'lucide-react';
import { ROBOT_SERIAL } from '@/lib/constants';

// Simplified template for Phil's interface
export default function MyTemplatePage() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [robotStatus, setRobotStatus] = useState<{battery: number, connected: boolean}>({
    battery: 0,
    connected: false
  });
  
  // Check robot status on mount
  useEffect(() => {
    const checkRobotStatus = async () => {
      try {
        const response = await fetch(`/api/robot/status?serial=${ROBOT_SERIAL}`);
        if (response.ok) {
          const data = await response.json();
          setRobotStatus({
            battery: data.battery || 0,
            connected: true
          });
        }
      } catch (error) {
        console.error("Failed to check robot status:", error);
      }
    };
    
    checkRobotStatus();
    
    // Poll robot status every 10 seconds
    const interval = setInterval(checkRobotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 space-y-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Robot Mission Control</h1>
        <div className="flex items-center gap-3">
          {robotStatus.connected ? (
            <div className="flex items-center text-sm">
              <BatteryMedium className={`h-4 w-4 mr-1 ${
                robotStatus.battery > 50 ? 'text-green-500' : 
                robotStatus.battery > 20 ? 'text-yellow-500' : 
                'text-red-500'
              }`} />
              <span>{robotStatus.battery}%</span>
            </div>
          ) : (
            <div className="flex items-center text-sm text-red-500">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span>Offline</span>
            </div>
          )}
          
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm">{user.username}</span>
              <button 
                className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5"
                onClick={() => logoutMutation.mutate()}
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Main dashboard card for Phil */}
      <Card className="p-6 bg-white shadow-md border-t-4 border-t-blue-500">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">Robot Control Dashboard</h2>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            Welcome to the new simplified robot control interface. Select a service type to begin.
          </p>
          
          {!robotStatus.connected && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 text-sm">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Robot appears to be offline. Please check the connection.
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-green-100 bg-green-50" 
                onClick={() => navigate('/workflow')}>
            <div className="flex flex-col items-center">
              <div className="bg-green-100 p-4 rounded-full mb-3">
                <ShowerHead className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-green-700">Laundry Service</h3>
              <p className="text-sm text-center text-gray-600 mt-2">
                Pickup or dropoff laundry bins from rooms
              </p>
              <Button className="mt-4 w-full bg-green-600 hover:bg-green-700">
                Start Laundry Task
              </Button>
            </div>
          </Card>
          
          <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-blue-100 bg-blue-50"
                onClick={() => navigate('/workflow')}>
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 p-4 rounded-full mb-3">
                <Trash2 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-blue-700">Trash Service</h3>
              <p className="text-sm text-center text-gray-600 mt-2">
                Pickup or dropoff trash bins from rooms
              </p>
              <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                Start Trash Task
              </Button>
            </div>
          </Card>
        </div>
      </Card>
      
      <div className="text-center text-sm text-gray-500 mt-8">
        <p>Robot ready for operations • {robotStatus.connected ? 'Online' : 'Offline'}</p>
        <p className="text-xs mt-1">Serial: {ROBOT_SERIAL}</p>
      </div>
    </div>
  );
}