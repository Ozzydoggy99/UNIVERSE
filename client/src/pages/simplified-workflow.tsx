/**
 * Simplified Workflow UI
 * 
 * This module implements a simplified, guided workflow UI that matches the mockups
 * and automatically adapts to the robot's capabilities.
 */

import { useState, useEffect } from 'react';
import { useLocation, useParams, Link, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShowerHead, Trash2, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

// Interface definitions for robot capabilities data
interface ServiceType {
  id: string;
  displayName: string;
  icon: string;
  enabled: boolean;
}

interface OperationType {
  id: string;
  displayName: string;
  enabled: boolean;
}

interface Floor {
  id: string;
  displayName: string;
  floorNumber: number;
}

interface ShelfPoint {
  id: string;
  displayName: string;
  x: number;
  y: number;
}

/**
 * Service Selection Page
 * 
 * This is the first step in the workflow where users select the service type
 * (e.g., Laundry, Trash).
 */
export default function ServiceSelectionPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Fetch service types from the API
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/simplified-workflow/service-types'],
    retry: 1,
    select: (data) => data as { serviceTypes: ServiceType[] }
  });
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-2 text-xl">Loading service types...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 border-red-300 bg-red-50">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error Loading Service Types</h2>
          <p className="text-gray-700">
            Could not load available service types. Please try again later or contact support.
          </p>
          <Button 
            className="mt-4 bg-primary" 
            onClick={() => navigate('/')}
          >
            Return Home
          </Button>
        </Card>
      </div>
    );
  }
  
  const serviceTypes = data?.serviceTypes || [];
  
  const handleSelect = (serviceType: ServiceType) => {
    if (!serviceType.enabled) {
      toast({
        title: "Service Unavailable",
        description: `The ${serviceType.displayName} service is currently not available.`,
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/simplified-workflow/${serviceType.id}`);
  };
  
  return (
    <div className="container mx-auto p-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Select Service Type</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceTypes.map((serviceType: ServiceType) => (
              <ServiceCard 
                key={serviceType.id}
                serviceType={serviceType}
                onSelect={() => handleSelect(serviceType)}
              />
            ))}
          </div>
          
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Service Card Component
 * 
 * Displays a card for a service type with its icon and name.
 */
function ServiceCard({ 
  serviceType, 
  onSelect,
  isSelected = false
}: { 
  serviceType: ServiceType, 
  onSelect: () => void,
  isSelected?: boolean
}) {
  const iconComponent = serviceType.icon === 'shower' 
    ? <ShowerHead className="h-8 w-8" /> 
    : <Trash2 className="h-8 w-8" />;
  
  const baseClasses = "p-4 hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center";
  const colorClasses = serviceType.enabled
    ? (isSelected 
      ? "border-green-500 bg-green-100" 
      : "border-gray-300 bg-white hover:bg-gray-50")
    : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60";
    
  return (
    <Card 
      className={`${baseClasses} ${colorClasses}`}
      onClick={serviceType.enabled ? onSelect : undefined}
    >
      <div className={`p-4 rounded-full ${isSelected ? 'bg-green-500' : 'bg-gray-100'} mb-3`}>
        <div className={isSelected ? 'text-white' : 'text-gray-600'}>
          {iconComponent}
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-700">{serviceType.displayName}</h3>
      
      {isSelected && (
        <div className="mt-3 text-green-600 flex items-center">
          <Check className="h-5 w-5 mr-1" /> Selected
        </div>
      )}
    </Card>
  );
}

/**
 * Operation Selection Page
 * 
 * This is the second step in the workflow where users select the operation
 * (e.g., Pickup, Dropoff).
 */
export function OperationSelectionPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { serviceType } = params;
  const { toast } = useToast();
  
  // Fetch operations for the selected service type
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/simplified-workflow/service-types/${serviceType}/operations`],
    retry: 1,
    select: (data) => data as { operations: OperationType[] }
  });
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-2 text-xl">Loading operations...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 border-red-300 bg-red-50">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error Loading Operations</h2>
          <p className="text-gray-700">
            Could not load available operations. Please try again later or contact support.
          </p>
          <Button 
            className="mt-4 bg-primary" 
            onClick={() => navigate(`/simplified-workflow`)}
          >
            Back to Service Selection
          </Button>
        </Card>
      </div>
    );
  }
  
  const operations = data?.operations || [];
  
  const handleSelect = (operation: OperationType) => {
    if (!operation.enabled) {
      toast({
        title: "Operation Unavailable",
        description: `The ${operation.displayName} operation is currently not available.`,
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/simplified-workflow/${serviceType}/${operation.id}`);
  };
  
  return (
    <div className="container mx-auto p-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Select Operation</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {operations.map((operation: OperationType) => (
              <OperationCard 
                key={operation.id}
                operation={operation}
                onSelect={() => handleSelect(operation)}
              />
            ))}
          </div>
          
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => navigate('/simplified-workflow')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Service Types
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Operation Card Component
 * 
 * Displays a card for an operation with its name and status.
 */
function OperationCard({ 
  operation, 
  onSelect,
  isSelected = false
}: { 
  operation: OperationType, 
  onSelect: () => void,
  isSelected?: boolean
}) {
  const baseClasses = "p-4 hover:shadow-lg transition-shadow cursor-pointer";
  const colorClasses = operation.enabled
    ? (isSelected 
      ? "border-green-500 bg-green-100" 
      : "border-gray-300 bg-white hover:bg-gray-50")
    : "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60";
    
  return (
    <Card 
      className={`${baseClasses} ${colorClasses}`}
      onClick={operation.enabled ? onSelect : undefined}
    >
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-medium text-gray-700">{operation.displayName}</h3>
        
        {isSelected && (
          <div className="mt-3 text-green-600 flex items-center">
            <Check className="h-5 w-5 mr-1" /> Selected
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Floor Selection Page
 * 
 * This is the third step in the workflow where users select the floor
 * (e.g., Floor 1, Floor 2).
 */
export function FloorSelectionPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { serviceType, operationType } = params;
  const { toast } = useToast();
  
  // Fetch floors for the selected operation and service type
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/simplified-workflow/service-types/${serviceType}/operations/${operationType}/floors`],
    retry: 1,
    select: (data) => data as { floors: Floor[] }
  });
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-2 text-xl">Loading floors...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 border-red-300 bg-red-50">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error Loading Floors</h2>
          <p className="text-gray-700">
            Could not load available floors. Please try again later or contact support.
          </p>
          <Button 
            className="mt-4 bg-primary" 
            onClick={() => navigate(`/simplified-workflow/${serviceType}`)}
          >
            Back to Operations
          </Button>
        </Card>
      </div>
    );
  }
  
  const floors = data?.floors || [];
  
  // Sort floors by floor number
  const sortedFloors = [...floors].sort((a, b) => a.floorNumber - b.floorNumber);
  
  const handleSelect = (floor: Floor) => {
    navigate(`/simplified-workflow/${serviceType}/${operationType}/${floor.id}`);
  };
  
  return (
    <div className="container mx-auto p-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Select Floor</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedFloors.map((floor: Floor) => (
              <FloorCard 
                key={floor.id}
                floor={floor}
                onSelect={() => handleSelect(floor)}
              />
            ))}
          </div>
          
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => navigate(`/simplified-workflow/${serviceType}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Operations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Floor Card Component
 * 
 * Displays a card for a floor with its name.
 */
function FloorCard({ 
  floor, 
  onSelect,
  isSelected = false
}: { 
  floor: Floor, 
  onSelect: () => void,
  isSelected?: boolean
}) {
  const baseClasses = "p-4 hover:shadow-lg transition-shadow cursor-pointer";
  const colorClasses = isSelected 
    ? "border-green-500 bg-green-100" 
    : "border-gray-300 bg-white hover:bg-gray-50";
    
  return (
    <Card 
      className={`${baseClasses} ${colorClasses}`}
      onClick={onSelect}
    >
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-medium text-gray-700">{floor.displayName}</h3>
        
        {isSelected && (
          <div className="mt-3 text-green-600 flex items-center">
            <Check className="h-5 w-5 mr-1" /> Selected
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Shelf Selection Page
 * 
 * This is the fourth step in the workflow where users select the shelf
 * (e.g., 104, 112, etc.).
 */
export function ShelfSelectionPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { serviceType, operationType, floorId } = params;
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  
  // Fetch shelves for the selected floor, operation, and service type
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/simplified-workflow/service-types/${serviceType}/operations/${operationType}/floors/${floorId}/shelves`],
    retry: 1,
    select: (data) => data as { shelves: ShelfPoint[] }
  });
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="ml-2 text-xl">Loading shelves...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6 border-red-300 bg-red-50">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error Loading Shelves</h2>
          <p className="text-gray-700">
            Could not load available shelves. Please try again later or contact support.
          </p>
          <Button 
            className="mt-4 bg-primary" 
            onClick={() => navigate(`/simplified-workflow/${serviceType}/${operationType}`)}
          >
            Back to Floors
          </Button>
        </Card>
      </div>
    );
  }
  
  const shelves = data?.shelves || [];
  
  // Sort shelves by displayName numerically
  const sortedShelves = [...shelves].sort((a, b) => {
    const aNum = parseInt(a.displayName) || 0;
    const bNum = parseInt(b.displayName) || 0;
    return aNum - bNum;
  });
  
  const handleSelect = (shelf: ShelfPoint) => {
    setSelectedShelf(shelf.id);
  };
  
  const handleExecute = async () => {
    if (!selectedShelf) {
      toast({
        title: "No Shelf Selected",
        description: "Please select a shelf to continue.",
        variant: "destructive"
      });
      return;
    }
    
    setIsExecuting(true);
    
    try {
      // Execute the workflow
      const response = await axios.post('/api/simplified-workflow/execute', {
        serviceType,
        operationType,
        floorId,
        shelfId: selectedShelf
      });
      
      toast({
        title: "Workflow Started",
        description: `Robot mission started with ID: ${response.data.missionId}`,
        variant: "default"
      });
      
      // Return to the dashboard
      navigate('/');
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast({
        title: "Workflow Error",
        description: "Failed to start the robot workflow. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Select Shelf</h1>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sortedShelves.map((shelf: ShelfPoint) => (
              <ShelfCard 
                key={shelf.id}
                shelf={shelf}
                onSelect={() => handleSelect(shelf)}
                isSelected={selectedShelf === shelf.id}
              />
            ))}
          </div>
          
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => navigate(`/simplified-workflow/${serviceType}/${operationType}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Floors
            </Button>
            
            <Button 
              disabled={!selectedShelf || isExecuting}
              onClick={handleExecute}
              className="bg-green-600 hover:bg-green-700"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Start Robot Mission
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Shelf Card Component
 * 
 * Displays a card for a shelf with its name.
 */
function ShelfCard({ 
  shelf, 
  onSelect,
  isSelected = false
}: { 
  shelf: ShelfPoint, 
  onSelect: () => void,
  isSelected?: boolean
}) {
  const baseClasses = "p-4 hover:shadow-lg transition-shadow cursor-pointer";
  const colorClasses = isSelected 
    ? "border-green-500 bg-green-100" 
    : "border-gray-300 bg-white hover:bg-gray-50";
    
  return (
    <Card 
      className={`${baseClasses} ${colorClasses}`}
      onClick={onSelect}
    >
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-medium text-gray-700">{shelf.displayName}</h3>
        
        {isSelected && (
          <div className="mt-3 text-green-600 flex items-center">
            <Check className="h-5 w-5 mr-1" /> Selected
          </div>
        )}
      </div>
    </Card>
  );
}