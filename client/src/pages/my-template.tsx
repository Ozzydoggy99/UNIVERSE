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

  // Add a redirect effect - this will automatically take users to the operations page
  useEffect(() => {
    // Skip service type selection entirely and go straight to operations
    navigate('/simplified-workflow/operations');
  }, [navigate]);
  
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
      
      {/* Loading indicator while redirecting */}
      <div className="flex justify-center items-center">
        <p>Redirecting to simplified workflow...</p>
      </div>
      
      <div className="text-center text-sm text-gray-500 mt-8">
        <p>Robot ready for operations • {robotStatus.connected ? 'Online' : 'Offline'}</p>
        <p className="text-xs mt-1">Serial: {ROBOT_SERIAL}</p>
      </div>
    </div>
  );
}