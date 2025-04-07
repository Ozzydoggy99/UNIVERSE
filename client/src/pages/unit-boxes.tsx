import React from 'react';
import { useLocation, useParams } from 'wouter';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { LogOut } from 'lucide-react';

interface UnitBoxesProps {
  user: User | null;
}

export default function UnitBoxes({ user }: UnitBoxesProps) {
  const { logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams();
  const floorNumber = parseInt(params.floorNumber || '1');
  
  // Extract service type and action type from the URL
  const pathSegments = window.location.pathname.split('/');
  const serviceType = pathSegments[1] as 'laundry' | 'trash';
  const actionType = pathSegments[2] as 'pickup' | 'dropoff';
  
  const [activeBox, setActiveBox] = React.useState<number | null>(null);
  const [lastActivated, setLastActivated] = React.useState<number | null>(null);
  
  // Determine number of units per floor (typically 10)
  const unitsPerFloor = 10;
  
  // Calculate the base unit number for this floor (e.g., floor 1 starts with 101, floor 2 with 201)
  const baseUnitNumber = floorNumber * 100 + 1;
  
  // Handle unit box click
  const handleBoxClick = (unitNumber: number) => {
    setActiveBox(unitNumber);
    setLastActivated(unitNumber);
    
    // Reset active state after 1 second
    setTimeout(() => {
      setActiveBox(null);
    }, 1000);
  };
  
  // Return to the floor selection page
  const handleBackClick = () => {
    navigate(`/${serviceType}/${actionType}/numbers`);
  };
  
  // Format the title based on service type and action
  const getTitle = () => {
    const service = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
    const action = actionType.charAt(0).toUpperCase() + actionType.slice(1);
    return `${service} ${action} - Floor ${floorNumber}`;
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      {/* Skytech Logo in top-left */}
      <div className="absolute top-4 left-4 text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent px-2 py-1 border-l-2 border-green-500">
        SKYTECH
      </div>
      
      {/* Logout Button */}
      <button 
        className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition-transform"
        onClick={() => logoutMutation.mutate()}
        aria-label="Logout"
      >
        <LogOut className="h-6 w-6 text-red-600 drop-shadow-glow-red" />
      </button>
      
      {/* Back Button */}
      <button 
        className="absolute top-4 left-16 ml-6 text-sm text-gray-700 hover:underline"
        onClick={handleBackClick}
      >
        ← Back to Floor Selection
      </button>
      
      <div className="pt-16 pb-8">
        <h1 className="text-2xl font-bold text-center mb-4">{getTitle()}</h1>
        
        {lastActivated && (
          <div className="text-center mb-6 bg-white p-3 rounded-lg shadow-sm max-w-sm mx-auto">
            <p className="text-lg">
              Unit <span className="font-bold">{lastActivated}</span> activated
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
          {Array.from({ length: unitsPerFloor }).map((_, index) => {
            const unitNumber = baseUnitNumber + index;
            return (
              <button
                key={unitNumber}
                className={`aspect-square rounded-lg relative flex items-center justify-center 
                         shadow-md hover:shadow-lg transform transition-all
                         bg-black text-white border border-gray-700 overflow-hidden
                         ${activeBox === unitNumber ? 'scale-95 brightness-90' : 'hover:translate-y-[-2px]'}`}
                onClick={() => handleBoxClick(unitNumber)}
              >
                <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
                <div className="font-bold text-2xl tracking-wide px-4 py-2 bg-white/10 rounded-md shadow-inner border border-white/10">
                  {unitNumber}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-white/10 to-transparent"></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}