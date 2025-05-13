/**
 * Simplified Workflow UI
 * 
 * This module implements a simplified, guided workflow UI that matches the mockups
 * and automatically adapts to the robot's capabilities.
 */

import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeftCircle, ShowerHead, Trash2, LogOut, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";

// Service type data structure
interface ServiceType {
  id: string;
  displayName: string;
  icon: string;
  enabled: boolean;
}

// Shelf point data structure
interface ShelfPoint {
  id: string;
  displayName: string;
  x: number;
  y: number;
}

// Map data structure
interface MapData {
  id: string;
  name: string;
  shelfPoints: ShelfPoint[];
}

// Main service selection page
export default function ServiceSelectionPage() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const { toast } = useToast();
  
  // Load available service types
  useEffect(() => {
    const fetchServiceTypes = async () => {
      try {
        const response = await axios.get('/api/workflow/service-types');
        if (response.data.success) {
          setServiceTypes(response.data.serviceTypes);
        } else {
          toast({
            title: "Error",
            description: response.data.error || "Failed to load service types",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchServiceTypes();
  }, [toast]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-4" />
        <p>Loading available services...</p>
      </div>
    );
  }
  
  // If no service types are available or enabled
  if (serviceTypes.length === 0 || !serviceTypes.some(st => st.enabled)) {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center mb-6">
          <Link href="/my-template">
            <div className="flex items-center cursor-pointer">
              <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
              <span className="mx-2">—</span>
              <span>Back</span>
            </div>
          </Link>
          <div className="ml-auto flex items-center">
            <span className="mr-2 text-lg">{user?.username}</span>
            <button 
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
              onClick={() => logoutMutation.mutate()}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <div className="flex flex-col items-center justify-center flex-1">
          <Card className="max-w-md w-full p-6 bg-amber-50 border-amber-200">
            <CardContent>
              <h2 className="text-xl font-semibold text-amber-700 mb-4">No Services Available</h2>
              <p className="text-gray-700 mb-4">
                There are no service types configured for this robot template. Please contact an administrator.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/my-template')}
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <footer className="flex justify-end mt-4">
          <Button variant="outline" className="bg-indigo-500 text-white">
            View Static Map (No HMR)
          </Button>
        </footer>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href="/my-template">
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">{user?.username}</span>
          <button 
            className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
            onClick={() => logoutMutation.mutate()}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 space-y-8">
        {serviceTypes.filter(st => st.enabled).map((serviceType) => (
          <ServiceCard 
            key={serviceType.id}
            title={serviceType.displayName} 
            icon={serviceType.icon}
            serviceTypeId={serviceType.id}
            onClick={() => navigate(`/simplified-workflow/${serviceType.id}`)}
          />
        ))}
      </div>

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Service card component
function ServiceCard({ 
  title, 
  icon,
  serviceTypeId,
  onClick 
}: { 
  title: string, 
  icon: string,
  serviceTypeId: string,
  onClick: () => void
}) {
  // Determine card color based on service type
  const bgColor = serviceTypeId === 'laundry' ? 'bg-green-500' : 'bg-blue-500';
  
  // Render the appropriate icon based on the icon name
  const renderIcon = () => {
    switch (icon) {
      case 'ShowerHead':
        return <ShowerHead size={48} />;
      case 'Trash2':
        return <Trash2 size={48} />;
      default:
        return null;
    }
  };
  
  return (
    <Card 
      className={`w-64 h-64 ${bgColor} text-white cursor-pointer transition-transform hover:scale-105`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-full">
        <div className="mb-4">
          {renderIcon()}
        </div>
        <div className="bg-black/20 px-4 py-2 rounded-md">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      </CardContent>
    </Card>
  );
}

// Operation selection page (pickup/dropoff)
export function OperationSelectionPage() {
  const [match, params] = useRoute("/simplified-workflow/:serviceType");
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  
  if (!match) {
    return <div>Invalid route</div>;
  }
  
  const serviceType = params?.serviceType || "";
  // Capitalize first letter for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href="/simplified-workflow">
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">{user?.username}</span>
          <button 
            className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
            onClick={() => logoutMutation.mutate()}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <h2 className="text-3xl font-semibold text-center mb-8 text-green-700">
        {serviceTitle} Service
      </h2>

      <div className="flex flex-col items-center justify-center flex-1 space-y-8">
        <OperationCard 
          title="Pickup"
          description={`Pick up ${serviceType} from a box`}
          onClick={() => navigate(`/simplified-workflow/${serviceType}/pickup`)}
          isLight={true}
        />
        
        <OperationCard 
          title="Dropoff"
          description={`Drop off ${serviceType} to a box`}
          onClick={() => navigate(`/simplified-workflow/${serviceType}/dropoff`)}
          isLight={false}
        />
      </div>

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Operation card component
function OperationCard({ 
  title, 
  description, 
  onClick,
  isLight
}: { 
  title: string, 
  description: string, 
  onClick: () => void,
  isLight: boolean
}) {
  const bgColor = isLight ? 'bg-white' : 'bg-black';
  const textColor = isLight ? 'text-black' : 'text-white';
  const borderClass = isLight ? 'border-2' : '';
  
  return (
    <Card 
      className={`w-full max-w-md p-4 ${bgColor} ${textColor} ${borderClass} cursor-pointer hover:shadow-lg`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center py-8">
        <h3 className="text-3xl font-bold mb-2">{title}</h3>
        <p>{description}</p>
      </CardContent>
    </Card>
  );
}

// Floor selection page
export function FloorSelectionPage() {
  const [match, params] = useRoute("/simplified-workflow/:serviceType/:operationType");
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [maps, setMaps] = useState<MapData[]>([]);
  
  if (!match) {
    return <div>Invalid route</div>;
  }
  
  const serviceType = params?.serviceType || "";
  const operationType = params?.operationType || "";
  
  // Capitalize for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  const operationTitle = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  
  // Load available maps/floors
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const response = await axios.get('/api/workflow/maps');
        if (response.data.success) {
          setMaps(response.data.maps);
          
          // Auto select if only one floor is available
          if (response.data.maps.length === 1) {
            setTimeout(() => {
              navigate(`/simplified-workflow/${serviceType}/${operationType}/${response.data.maps[0].id}`);
            }, 500);
          }
        } else {
          toast({
            title: "Error",
            description: response.data.error || "Failed to load floor data",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchMaps();
  }, [toast, serviceType, operationType, navigate]);
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-4" />
        <p>Loading available floors...</p>
      </div>
    );
  }
  
  // If no maps/floors are available
  if (maps.length === 0) {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center mb-6">
          <Link href={`/simplified-workflow/${serviceType}`}>
            <div className="flex items-center cursor-pointer">
              <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
              <span className="mx-2">—</span>
              <span>Back</span>
            </div>
          </Link>
          <div className="ml-auto flex items-center">
            <span className="mr-2 text-lg">{user?.username}</span>
            <button 
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
              onClick={() => logoutMutation.mutate()}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <h2 className="text-3xl font-semibold text-center mb-8">
          {serviceTitle} {operationTitle} - Select Floor
        </h2>
        
        <div className="flex flex-col items-center justify-center flex-1">
          <Card className="max-w-md w-full p-6 bg-red-50 border-red-200">
            <CardContent>
              <h2 className="text-xl font-semibold text-red-700 mb-4">No Floors Available</h2>
              <p className="text-gray-700 mb-4">
                There are no floors configured for this robot. Please contact an administrator.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/simplified-workflow/${serviceType}`)}
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <footer className="flex justify-end mt-4">
          <Button variant="outline" className="bg-indigo-500 text-white">
            View Static Map (No HMR)
          </Button>
        </footer>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href={`/simplified-workflow/${serviceType}`}>
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">{user?.username}</span>
          <button 
            className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
            onClick={() => logoutMutation.mutate()}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <h2 className="text-3xl font-semibold text-center mb-8">
        {serviceTitle} {operationTitle} - Select Floor
      </h2>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {maps.map((map, index) => {
          // Skip maps without shelf points
          if (!map.shelfPoints || map.shelfPoints.length === 0) {
            return null;
          }
          
          // Colors for different floors
          const colors = ['bg-red-400', 'bg-green-400', 'bg-blue-400', 'bg-yellow-400'];
          const bgColor = colors[index % colors.length];
          
          return (
            <FloorCard
              key={map.id}
              floorNumber={map.id}
              color={bgColor}
              onClick={() => navigate(`/simplified-workflow/${serviceType}/${operationType}/${map.id}`)}
            />
          );
        })}
      </div>

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Floor card component
function FloorCard({ 
  floorNumber, 
  color, 
  onClick 
}: { 
  floorNumber: string, 
  color: string, 
  onClick: () => void 
}) {
  return (
    <Card 
      className={`${color} cursor-pointer transition-transform hover:scale-102`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] p-4 text-white">
        <div className="flex items-center justify-center w-16 h-16 bg-black/20 rounded-md mb-4">
          <span className="text-2xl font-bold">{floorNumber}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Shelf selection page
export function ShelfSelectionPage() {
  const [match, params] = useRoute("/simplified-workflow/:serviceType/:operationType/:floorId");
  const [, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shelves, setShelves] = useState<ShelfPoint[]>([]);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [executingWorkflow, setExecutingWorkflow] = useState(false);
  
  if (!match) {
    return <div>Invalid route</div>;
  }
  
  const serviceType = params?.serviceType || "";
  const operationType = params?.operationType || "";
  const floorId = params?.floorId || "";
  
  // Capitalize for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  const operationTitle = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  
  // Load available shelves for this floor
  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const response = await axios.get('/api/workflow/maps');
        if (response.data.success) {
          const selectedMap = response.data.maps.find((map: MapData) => map.id === floorId);
          if (selectedMap && selectedMap.shelfPoints) {
            setShelves(selectedMap.shelfPoints);
          } else {
            toast({
              title: "Error",
              description: "No shelf points found for this floor",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Error",
            description: response.data.error || "Failed to load shelf data",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchShelves();
  }, [toast, floorId]);
  
  // Execute the workflow with the selected parameters
  const executeWorkflow = async () => {
    if (!selectedShelf) {
      toast({
        title: "Selection required",
        description: "Please select a shelf point first",
        variant: "destructive",
      });
      return;
    }
    
    setExecutingWorkflow(true);
    
    try {
      // Determine the appropriate workflow based on operation type
      const workflowEndpoint = operationType === 'pickup'
        ? '/api/pickup-to-104/workflow' // For pickup from central to shelf
        : '/api/pickup-from-104/workflow'; // For dropoff from shelf to central
      
      // Execute the workflow with the selected shelf
      const response = await axios.post(workflowEndpoint, {
        // The ID comes from the shelf point (e.g., "104_load")
        shelfPointId: selectedShelf
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Workflow started successfully",
          variant: "default",
        });
        
        // Navigate to a confirmation/tracking page
        navigate('/workflow-status');
      } else {
        toast({
          title: "Error",
          description: response.data.error || "Failed to start workflow",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute workflow",
        variant: "destructive",
      });
    } finally {
      setExecutingWorkflow(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-4" />
        <p>Loading available shelves...</p>
      </div>
    );
  }
  
  // If no shelves are available
  if (shelves.length === 0) {
    return (
      <div className="flex flex-col min-h-screen p-4">
        <header className="flex items-center mb-6">
          <Link href={`/simplified-workflow/${serviceType}/${operationType}`}>
            <div className="flex items-center cursor-pointer">
              <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
              <span className="mx-2">—</span>
              <span>Back</span>
            </div>
          </Link>
          <div className="ml-auto flex items-center">
            <span className="mr-2 text-lg">{user?.username}</span>
            <button 
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
              onClick={() => logoutMutation.mutate()}
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
        
        <h2 className="text-3xl font-semibold text-center mb-8">
          {serviceTitle} {operationTitle} - Select Shelf
        </h2>
        
        <div className="flex flex-col items-center justify-center flex-1">
          <Card className="max-w-md w-full p-6 bg-red-50 border-red-200">
            <CardContent>
              <h2 className="text-xl font-semibold text-red-700 mb-4">No Shelves Available</h2>
              <p className="text-gray-700 mb-4">
                There are no shelf points configured for this floor. Please contact an administrator.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/simplified-workflow/${serviceType}/${operationType}`)}
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <footer className="flex justify-end mt-4">
          <Button variant="outline" className="bg-indigo-500 text-white">
            View Static Map (No HMR)
          </Button>
        </footer>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href={`/simplified-workflow/${serviceType}/${operationType}`}>
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">{user?.username}</span>
          <button 
            className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white"
            onClick={() => logoutMutation.mutate()}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {shelves.map((shelf) => (
          <ShelfCard
            key={shelf.id}
            shelfNumber={shelf.displayName}
            isSelected={selectedShelf === shelf.id}
            onClick={() => setSelectedShelf(shelf.id)}
          />
        ))}
      </div>

      <div className="mt-8">
        <Button 
          className="w-full py-6 text-lg bg-green-500 hover:bg-green-600"
          onClick={executeWorkflow}
          disabled={!selectedShelf || executingWorkflow}
        >
          {executingWorkflow ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Confirm Selection
            </>
          )}
        </Button>
      </div>

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Shelf card component
function ShelfCard({ 
  shelfNumber, 
  isSelected,
  onClick 
}: { 
  shelfNumber: string, 
  isSelected: boolean,
  onClick: () => void 
}) {
  const bgColor = isSelected ? 'bg-green-500' : 'bg-black';
  
  return (
    <Card 
      className={`${bgColor} cursor-pointer transition-all duration-200`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] p-4 text-white relative">
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="h-6 w-6" />
          </div>
        )}
        <div className="flex items-center justify-center w-16 h-16 bg-black/20 rounded-md mb-4">
          <span className="text-2xl font-bold">{shelfNumber}</span>
        </div>
      </CardContent>
    </Card>
  );
}