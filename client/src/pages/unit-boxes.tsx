import React from 'react';
import { useLocation, useParams } from 'wouter';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

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
  
  const [selectedBox, setSelectedBox] = React.useState<number | null>(null);
  const [lastActivated, setLastActivated] = React.useState<number | null>(null);
  
  // Fetch template settings to get custom unit configuration
  const [unitsPerFloor, setUnitsPerFloor] = React.useState(10);
  const [unitStartNumber, setUnitStartNumber] = React.useState(1);
  const [customUnitNumbers, setCustomUnitNumbers] = React.useState<Record<string, Record<number, number>>>({});
  const [floorCustomNumbers, setFloorCustomNumbers] = React.useState<Record<number, number>>({}); 
  
  // Fetch template data to get custom unit settings
  React.useEffect(() => {
    if (user?.templateId) {
      const fetchTemplateSettings = async () => {
        try {
          const response = await fetch(`/api/templates/${user.templateId}`);
          if (response.ok) {
            const templateData = await response.json();
            if (templateData && templateData.layout) {
              const layout = JSON.parse(templateData.layout);
              
              // Find the service component (laundry/trash)
              const serviceComponent = layout.components.find((comp: any) => 
                comp.type === 'rectangle' && comp.icon === serviceType
              );
              
              if (serviceComponent) {
                // Check for custom unit settings
                if (serviceComponent.unitsPerFloor) {
                  setUnitsPerFloor(Math.min(Math.max(1, serviceComponent.unitsPerFloor), 20));
                }
                
                if (serviceComponent.unitStartNumber) {
                  setUnitStartNumber(serviceComponent.unitStartNumber);
                }
                
                // Load custom unit numbers if available
                if (serviceComponent.customUnitNumbers) {
                  // Store all custom unit numbers by floor
                  setCustomUnitNumbers(serviceComponent.customUnitNumbers);
                  
                  // Set floor-specific custom numbers for current floor
                  const floorKey = floorNumber.toString();
                  const floorNumbers = serviceComponent.customUnitNumbers[floorKey] || {};
                  setFloorCustomNumbers(floorNumbers);
                }
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch template settings:", error);
        }
      };
      
      fetchTemplateSettings();
    }
  }, [user?.templateId, serviceType, floorNumber]);
  
  // Calculate the base unit number for this floor
  // If unitStartNumber is 1 (default), we get 101, 201, etc.
  // If unitStartNumber is custom (e.g., 50), we get 150, 250, etc.
  const baseUnitNumber = floorNumber * 100 + unitStartNumber;
  
  // Handle unit box click
  const handleBoxClick = (unitNumber: number) => {
    setSelectedBox(unitNumber === selectedBox ? null : unitNumber);
    setLastActivated(unitNumber);
  };
  
  // Removed custom unit input functionality as per user request
  // Users should only be able to use buttons, not enter exact numbers
  
  // Return to the floor selection page
  const handleBackClick = () => {
    navigate(`/${serviceType}/${actionType}/numbers`);
  };
  
  // Handle confirmation button click
  const handleConfirm = () => {
    if (selectedBox) {
      // Show success message
      toast({
        title: "Success!",
        description: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} ${actionType} confirmed for Unit ${selectedBox}`,
        variant: "default",
      });
      
      // Navigate back to main template after a short delay
      setTimeout(() => {
        navigate('/my-template');
      }, 1500);
    } else {
      // Show error message if no box is selected
      toast({
        title: "Please select a unit",
        description: "You need to select a unit before confirming",
        variant: "destructive",
      });
    }
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
      
      {/* Logout Button with username */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-sm font-medium">{user?.username}</span>
        <button 
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 cursor-pointer transition-all flex items-center"
          onClick={() => logoutMutation.mutate()}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      
      {/* Back Button */}
      <button 
        className="absolute top-4 left-16 ml-6 text-sm text-gray-700 hover:underline"
        onClick={handleBackClick}
      >
        ← Back to Floor Selection
      </button>
      
      <div className="pt-16 pb-8">
        <h1 className="text-2xl font-bold text-center mb-4">{getTitle()}</h1>
        
        {selectedBox && (
          <div className="text-center mb-6 bg-white p-3 rounded-lg shadow-sm max-w-sm mx-auto border-2 border-green-500">
            <p className="text-lg">
              Unit <span className="font-bold text-green-600">{selectedBox}</span> selected
            </p>
          </div>
        )}
        
        {/* Removed "Enter Exact Unit Number" button as per user request */}
        
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto mb-8">
          {Array.from({ length: unitsPerFloor }).map((_, index) => {
            // Use custom unit number if available, otherwise calculate standard unit number
            const displayNumber = floorCustomNumbers[index] !== undefined 
              ? floorCustomNumbers[index] 
              : (baseUnitNumber + index);
            const isSelected = selectedBox === displayNumber;
            
            return (
              <button
                key={index}
                className={`aspect-square rounded-lg relative flex items-center justify-center 
                         shadow-md hover:shadow-lg transform transition-all
                         overflow-hidden
                         ${isSelected 
                            ? 'bg-green-500 text-white border-2 border-green-700 scale-100' 
                            : 'bg-black text-white border border-gray-700 hover:translate-y-[-2px]'}`}
                onClick={() => handleBoxClick(displayNumber)}
              >
                <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
                <div className={`font-bold text-2xl tracking-wide px-4 py-2 rounded-md shadow-inner border border-white/10
                               ${isSelected ? 'bg-green-600' : 'bg-white/10'}`}>
                  {displayNumber}
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-white/10 to-transparent"></div>
              </button>
            );
          })}
        </div>
        
        {/* Confirm Button */}
        <div className="max-w-xl mx-auto mt-6">
          <Button 
            className={`w-full py-6 text-lg font-semibold ${selectedBox ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}
            onClick={handleConfirm}
            disabled={!selectedBox}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}