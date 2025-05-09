import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ArrowLeftCircle, ShowerHead, Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ROBOT_SERIAL } from "@/lib/constants";

// Main service selection page
export default function WorkflowPage() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [robotStatus, setRobotStatus] = useState<{battery: number, connected: boolean}>({
    battery: 0,
    connected: false
  });
  
  // Get robot status on page load
  useEffect(() => {
    const checkRobotStatus = async () => {
      try {
        const response = await fetch(`/api/robot/status?serial=${ROBOT_SERIAL}`);
        const data = await response.json();
        
        if (response.ok && data) {
          setRobotStatus({
            battery: data.battery || 0,
            connected: true
          });
        }
      } catch (error) {
        console.error("Failed to fetch robot status:", error);
      }
    };
    
    checkRobotStatus();
    
    // Poll for robot status every 10 seconds
    const interval = setInterval(checkRobotStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // Go back to template page
  const handleBackClick = () => {
    navigate('/my-template');
  };
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
          <button 
            className="ml-4 text-sm text-gray-600 hover:underline"
            onClick={handleBackClick}
          >
            Back to Dashboard
          </button>
        </div>
        <div className="ml-auto flex items-center">
          {robotStatus.connected && (
            <div className="mr-4 flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-sm">Robot: {robotStatus.battery}%</span>
            </div>
          )}
          
          <span className="mr-2 text-lg">{user?.username || "Phil"}</span>
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
        <h2 className="text-2xl font-semibold mb-4">Select Service Type</h2>
        <ServiceCard 
          title="LAUNDRY" 
          icon={<ShowerHead size={48} />}
          href="/workflow/laundry"
          bgColor="bg-green-500"
        />
        
        <ServiceCard 
          title="TRASH" 
          icon={<Trash2 size={48} />}
          href="/workflow/trash"
          bgColor="bg-blue-500"
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

// Service type selection card
function ServiceCard({ 
  title, 
  icon, 
  href, 
  bgColor 
}: { 
  title: string, 
  icon: React.ReactNode, 
  href: string, 
  bgColor: string 
}) {
  return (
    <Link href={href}>
      <Card 
        className={`w-64 h-64 ${bgColor} text-white cursor-pointer transition-transform hover:scale-105`}
      >
        <CardContent className="flex flex-col items-center justify-center h-full">
          <div className="mb-4">
            {icon}
          </div>
          <div className="bg-black/20 px-4 py-2 rounded-md">
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Operation type selection page (pickup or dropoff)
export function OperationPage() {
  const [_, params] = useRoute("/workflow/:serviceType");
  const [, setLocation] = useLocation();
  const serviceType = params?.serviceType || "";
  
  // Capitalize first letter for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href="/">
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">Phil</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ArrowLeftCircle size={20} />
          </div>
        </div>
      </header>

      <h2 className="text-3xl font-semibold text-center mb-8 text-green-700">
        {serviceTitle} Service
      </h2>

      <div className="flex flex-col items-center justify-center flex-1 space-y-8">
        <OperationCard 
          title="Pickup"
          description={`Pick up ${serviceType} from a box`}
          onClick={() => setLocation(`/workflow/${serviceType}/pickup`)}
          bgColor="bg-white"
          textColor="text-black"
          border="border-2"
        />
        
        <OperationCard 
          title="Dropoff"
          description={`Drop off ${serviceType} to a box`}
          onClick={() => setLocation(`/workflow/${serviceType}/dropoff`)}
          bgColor="bg-black"
          textColor="text-white"
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

// Operation card component (Pickup/Dropoff)
function OperationCard({ 
  title, 
  description, 
  onClick, 
  bgColor, 
  textColor,
  border = ""
}: { 
  title: string, 
  description: string, 
  onClick: () => void, 
  bgColor: string, 
  textColor: string,
  border?: string
}) {
  return (
    <Card 
      className={`w-full max-w-xl p-4 ${bgColor} ${textColor} ${border} cursor-pointer transition-transform hover:scale-102`}
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
  const [_, params] = useRoute("/workflow/:serviceType/:operationType");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<Array<{ 
    id: string, 
    name: string, 
    displayName: string, 
    hasShelfPoints: boolean, 
    shelfCount: number 
  }>>([]);
  
  const serviceType = params?.serviceType || "";
  const operationType = params?.operationType || "";
  
  // Capitalize for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  const operationTitle = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  
  // Load available floors
  useEffect(() => {
    const fetchFloors = async () => {
      try {
        const response = await fetch("/api/workflow/maps");
        const data = await response.json();
        
        if (data.success && data.maps) {
          // Map data comes pre-sorted with priority to map "1" from the server
          // Transform the data for display
          const floorData = data.maps.map((map: any) => {
            // Create a cleaner name for display
            let displayName = map.id.includes("_") ? map.id.split("_")[1] : map.id;
            
            // Check if it has shelf points - add indicator
            const hasShelfPoints = map.shelfPoints && map.shelfPoints.length > 0;
            const shelfCount = hasShelfPoints ? ` (${map.shelfPoints.length} points)` : ' (No points)';
            
            // Prioritize map 1 with a visual indicator
            const isMap1 = map.id === "1";
            const priorityFlag = isMap1 ? " ★" : "";
            
            return {
              id: map.id,
              name: displayName,
              displayName: displayName + priorityFlag + shelfCount,
              hasShelfPoints: hasShelfPoints,
              shelfCount: map.shelfPoints?.length || 0
            };
          });
          
          setFloors(floorData);
          
          // Auto redirect to shelf selection for maps with only one floor and has shelf points
          if (floorData.length === 1 && floorData[0].hasShelfPoints) {
            console.log("Only one floor available with shelf points - auto-selecting");
            // Delay auto-selection to prevent race condition
            setTimeout(() => {
              setLocation(`/workflow/${serviceType}/${operationType}/${floorData[0].id}`);
            }, 500);
          }
        } else {
          toast({
            title: "Error loading floors",
            description: data.error || "Failed to load available floors",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Could not connect to server",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchFloors();
  }, [toast, serviceType, operationType]);
  
  // If we have no floors after loading, show an error state instead of using hardcoded floors
  const hasNoFloors = !loading && floors.length === 0;
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-4" />
        <p>Loading available floors...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href={`/workflow/${serviceType}`}>
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">Phil</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ArrowLeftCircle size={20} />
          </div>
        </div>
      </header>

      <h2 className="text-3xl font-semibold text-center mb-8">
        {serviceTitle} {operationTitle} - Select Floor
      </h2>

      {hasNoFloors ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 max-w-xl w-full">
            <h3 className="text-xl font-semibold text-red-700 mb-2">Unable to Load Floor Data</h3>
            <p className="text-gray-700 mb-4">
              Could not retrieve floor information from the robot. Please check that the robot is powered on and connected to the network.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 flex-1">
          {floors.map((floor, index) => (
            <FloorCard
              key={floor.id}
              number={floor.name}
              displayText={floor.displayName}
              color={getFloorColor(index, floor.id === "1")}
              disabled={!floor.hasShelfPoints}
              onClick={() => {
                if (floor.hasShelfPoints) {
                  setLocation(`/workflow/${serviceType}/${operationType}/${floor.id}`);
                } else {
                  toast({
                    title: "Floor unavailable",
                    description: "This floor has no shelf points and cannot be selected",
                    variant: "destructive",
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Floor Card Component
function FloorCard({ 
  number, 
  displayText,
  color, 
  disabled = false,
  onClick 
}: { 
  number: string, 
  displayText?: string,
  color: string, 
  disabled?: boolean,
  onClick: () => void 
}) {
  // Show the display text (which includes shelf count) or just the number
  const displayName = displayText || number;
  
  return (
    <Card 
      className={`${color} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer transition-transform hover:scale-102'}`}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-full min-h-[180px] p-4 text-white">
        <div className={`flex items-center justify-center w-16 h-16 ${color === 'bg-red-400' || color === 'bg-blue-400' ? 'bg-white/20' : 'bg-black/20'} rounded-md mb-4`}>
          <span className="text-2xl font-bold">{number}</span>
        </div>
        
        {displayText && displayText !== number && (
          <div className="text-center mt-2">
            <span className="text-sm">{displayText}</span>
          </div>
        )}
        
        {disabled && (
          <div className="mt-2 py-1 px-3 bg-white/20 rounded text-xs font-medium">
            No shelf points available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Get a color based on index - prioritize map "1" with green
function getFloorColor(index: number, isPrimaryMap: boolean = false): string {
  // If this is map "1", always use green
  if (isPrimaryMap) {
    return 'bg-green-500';
  }
  
  const colors = ['bg-red-400', 'bg-blue-400', 'bg-yellow-400', 'bg-purple-400'];
  return colors[index % colors.length];
}

// Shelf selection page
export function ShelfSelectionPage() {
  const [_, params] = useRoute("/workflow/:serviceType/:operationType/:floorId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shelves, setShelves] = useState<Array<{ id: string, displayName: string }>>([]);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  
  const serviceType = params?.serviceType || "";
  const operationType = params?.operationType || "";
  const floorId = params?.floorId || "";
  
  // Capitalize for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  const operationTitle = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  const floorName = floorId.includes("_") ? floorId.split("_")[1] : floorId;
  
  // Load available shelves for this floor - no fallback data
  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const response = await fetch("/api/workflow/maps");
        const data = await response.json();
        
        if (data.success && data.maps) {
          const floor = data.maps.find((map: any) => map.id === floorId);
          if (floor && floor.shelfPoints) {
            setShelves(floor.shelfPoints);
          } else {
            toast({
              title: "Floor not found",
              description: `Could not find shelf information for floor ${floorName}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Error loading shelves",
            description: data.error || "Failed to load available shelves",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Could not connect to server",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchShelves();
  }, [toast, floorId, floorName]);
  
  // Handle confirm button click
  const handleConfirm = () => {
    if (!selectedShelf) {
      toast({
        title: "Selection required",
        description: "Please select a shelf first",
        variant: "destructive",
      });
      return;
    }
    
    setLocation(`/workflow/confirm/${serviceType}/${operationType}/${floorId}/${selectedShelf}`);
  };
  
  // Check if we have any shelves after loading is complete
  const hasNoShelves = !loading && shelves.length === 0;
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-700 mb-4" />
        <p>Loading available shelves...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href={`/workflow/${serviceType}/${operationType}`}>
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">Phil</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ArrowLeftCircle size={20} />
          </div>
        </div>
      </header>

      <h2 className="text-3xl font-semibold text-center mb-8">
        {serviceTitle} {operationTitle} - Floor {floorName}
      </h2>

      {hasNoShelves ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 max-w-xl w-full">
            <h3 className="text-xl font-semibold text-red-700 mb-2">No Shelf Points Available</h3>
            <p className="text-gray-700 mb-4">
              Could not find any shelf points for floor {floorName}. Please check the robot's map configuration and ensure shelf points are correctly labeled.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {shelves.map((shelf, index) => (
              <ShelfCard
                key={shelf.id}
                number={shelf.displayName}
                selected={selectedShelf === shelf.id}
                color={selectedShelf === shelf.id ? 'bg-green-400' : (index === 0 ? 'bg-green-400' : 'bg-black')}
                onClick={() => setSelectedShelf(shelf.id)}
              />
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <Button 
              className="w-full max-w-xl py-6 bg-green-500 hover:bg-green-600 text-white"
              onClick={handleConfirm}
            >
              <span className="text-xl">Confirm Selection</span>
            </Button>
          </div>
        </>
      )}

      <footer className="flex justify-end mt-4">
        <Button variant="outline" className="bg-indigo-500 text-white">
          View Static Map (No HMR)
        </Button>
      </footer>
    </div>
  );
}

// Shelf Card Component
function ShelfCard({ 
  number, 
  selected,
  color, 
  onClick 
}: { 
  number: string, 
  selected: boolean,
  color: string, 
  onClick: () => void 
}) {
  return (
    <Card 
      className={`${color} cursor-pointer transition-transform hover:scale-102 text-white`}
      onClick={onClick}
    >
      <CardContent className="flex items-center justify-center h-full min-h-[180px] relative">
        {selected && (
          <div className="absolute top-2 right-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="white"/>
              <path d="M8 12L10.5 14.5L16 9" stroke="green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        <div className="flex items-center justify-center w-16 h-16 bg-black/20 rounded-md">
          <span className="text-2xl font-bold">{number}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Workflow confirmation page
export function WorkflowConfirmationPage() {
  const [_, params] = useRoute("/workflow/confirm/:serviceType/:operationType/:floorId/:shelfId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [statusPolling, setStatusPolling] = useState<number | null>(null);
  
  const serviceType = params?.serviceType || "";
  const operationType = params?.operationType || "";
  const floorId = params?.floorId || "";
  const shelfId = params?.shelfId || "";
  
  // Capitalize for display
  const serviceTitle = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  const operationTitle = operationType.charAt(0).toUpperCase() + operationType.slice(1);
  const floorName = floorId.includes("_") ? floorId.split("_")[1] : floorId;
  const shelfName = shelfId.includes("_") ? shelfId.split("_")[0] : shelfId;
  
  // Start the workflow
  const startWorkflow = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/workflow/${operationType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          operationType,
          floorId,
          shelfId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWorkflowId(data.workflowId);
        setWorkflowStarted(true);
        toast({
          title: "Workflow started",
          description: `${serviceTitle} ${operationTitle} workflow has started`,
        });
        
        // Start polling for workflow status
        const intervalId = setInterval(checkWorkflowStatus, 5000, data.workflowId);
        setStatusPolling(intervalId);
      } else {
        toast({
          title: "Failed to start workflow",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection error",
        description: "Could not connect to server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Check workflow status
  const checkWorkflowStatus = async (wfId: string) => {
    try {
      const response = await fetch(`/api/workflow/${wfId}`);
      const data = await response.json();
      
      if (data.success) {
        setWorkflowStatus(data.workflow);
        
        // If workflow is completed or failed, stop polling
        if (data.workflow.status === 'completed' || data.workflow.status === 'failed') {
          if (statusPolling) {
            clearInterval(statusPolling);
            setStatusPolling(null);
          }
          
          if (data.workflow.status === 'completed') {
            toast({
              title: "Workflow completed",
              description: `${serviceTitle} ${operationTitle} workflow has completed successfully!`,
            });
          } else {
            toast({
              title: "Workflow failed",
              description: data.workflow.error || "Unknown error",
              variant: "destructive",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking workflow status:", error);
    }
  };
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);
  
  const handleStartOrBack = () => {
    if (workflowStarted) {
      setLocation("/");
    } else {
      startWorkflow();
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-6">
        <Link href={`/workflow/${serviceType}/${operationType}/${floorId}`}>
          <div className="flex items-center cursor-pointer">
            <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
            <span className="mx-2">—</span>
            <span>Back</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">Phil</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ArrowLeftCircle size={20} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        {workflowStarted ? (
          <WorkflowStatus 
            status={workflowStatus} 
            serviceType={serviceTitle} 
            operationType={operationTitle}
            floorName={floorName}
            shelfName={shelfName}
          />
        ) : (
          <WorkflowSummary 
            serviceType={serviceTitle} 
            operationType={operationTitle}
            floorName={floorName}
            shelfName={shelfName}
          />
        )}
        
        <Button 
          className={`mt-8 px-8 py-6 ${workflowStarted ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
          onClick={handleStartOrBack}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : workflowStarted ? (
            <span className="text-xl">Return to Home</span>
          ) : (
            <span className="text-xl">Start {operationTitle}</span>
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

// Workflow Summary Component
function WorkflowSummary({ 
  serviceType, 
  operationType,
  floorName,
  shelfName
}: { 
  serviceType: string, 
  operationType: string,
  floorName: string,
  shelfName: string
}) {
  return (
    <Card className="w-full max-w-xl">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Workflow Summary</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="font-semibold">Service:</span>
            <span>{serviceType}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-semibold">Operation:</span>
            <span>{operationType}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-semibold">Floor:</span>
            <span>{floorName}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-semibold">Unit:</span>
            <span>{shelfName}</span>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-2">Robot will:</h3>
            <ul className="list-disc list-inside space-y-1">
              {operationType === "Pickup" ? (
                <>
                  <li>Go to unit {shelfName} on floor {floorName}</li>
                  <li>Pick up the {serviceType.toLowerCase()} bin</li>
                  <li>Take it to the collection point</li>
                  <li>Return to charging station</li>
                </>
              ) : (
                <>
                  <li>Get a {serviceType.toLowerCase()} bin from collection point</li>
                  <li>Take it to unit {shelfName} on floor {floorName}</li>
                  <li>Return to charging station</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Workflow Status Component
function WorkflowStatus({ 
  status, 
  serviceType, 
  operationType,
  floorName,
  shelfName
}: { 
  status: any | null, 
  serviceType: string, 
  operationType: string,
  floorName: string,
  shelfName: string
}) {
  if (!status) {
    return (
      <Card className="w-full max-w-xl">
        <CardContent className="p-6 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-center mb-6">Workflow Started</h2>
          <Loader2 className="h-12 w-12 animate-spin text-green-700 mb-4" />
          <p className="text-center">Loading workflow status...</p>
        </CardContent>
      </Card>
    );
  }
  
  const getStatusColor = () => {
    switch (status.status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'in-progress': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };
  
  const getStatusText = () => {
    switch (status.status) {
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'in-progress': return 'In Progress';
      case 'queued': return 'Queued';
      default: return 'Unknown';
    }
  };
  
  const getProgress = () => {
    if (!status.currentStep || !status.totalSteps) return 0;
    return (status.currentStep / status.totalSteps) * 100;
  };
  
  return (
    <Card className="w-full max-w-xl">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold text-center mb-6">
          {operationType} {serviceType} {status.status === 'completed' ? 'Completed' : 'In Progress'}
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="font-semibold">Operation:</span>
            <span>{operationType} from Unit {shelfName} (Floor {floorName})</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-semibold">Status:</span>
            <span className={getStatusColor()}>{getStatusText()}</span>
          </div>
          
          {status.currentStep && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Progress:</span>
                <span>Step {status.currentStep} of {status.totalSteps}</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          )}
          
          {status.error && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md">
              <span className="font-semibold">Error:</span> {status.error}
            </div>
          )}
          
          {status.status === 'completed' && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md flex items-center">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Operation successfully completed</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}