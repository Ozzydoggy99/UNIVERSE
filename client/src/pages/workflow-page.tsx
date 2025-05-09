import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ArrowLeftCircle, ShowerHead, Trash2 } from "lucide-react";

// Main service selection page
export default function WorkflowPage() {
  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center mb-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold text-green-700">SKYTECH</h1>
        </div>
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-lg">Phil</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <ArrowLeftCircle size={20} />
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center flex-1 space-y-8">
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
  const [floors, setFloors] = useState<Array<{ id: string, name: string }>>([]);
  
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
          setFloors(data.maps.map((map: any) => ({
            id: map.id,
            name: map.id.includes("_") ? map.id.split("_")[1] : map.id
          })));
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
  }, [toast]);
  
  // For demo, show 4 floors if API fails
  useEffect(() => {
    if (!loading && floors.length === 0) {
      setFloors([
        { id: "floor_1", name: "1" },
        { id: "floor_2", name: "2" },
        { id: "floor_3", name: "3" },
        { id: "floor_4", name: "4" }
      ]);
    }
  }, [loading, floors]);
  
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

      <div className="grid grid-cols-2 gap-4 flex-1">
        {floors.map((floor, index) => (
          <FloorCard
            key={floor.id}
            number={floor.name}
            color={getFloorColor(index)}
            onClick={() => setLocation(`/workflow/${serviceType}/${operationType}/${floor.id}`)}
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

// Floor Card Component
function FloorCard({ 
  number, 
  color, 
  onClick 
}: { 
  number: string, 
  color: string, 
  onClick: () => void 
}) {
  return (
    <Card 
      className={`${color} cursor-pointer transition-transform hover:scale-102`}
      onClick={onClick}
    >
      <CardContent className="flex items-center justify-center h-full min-h-[180px]">
        <div className={`flex items-center justify-center w-16 h-16 ${color === 'bg-red-400' || color === 'bg-blue-400' ? 'bg-white/20' : 'bg-black/20'} rounded-md`}>
          <span className="text-2xl font-bold text-white">{number}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Get a color based on index
function getFloorColor(index: number): string {
  const colors = ['bg-red-400', 'bg-green-400', 'bg-blue-400', 'bg-yellow-400'];
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
  
  // Load available shelves for this floor
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
            // Demo data
            setShelves([
              { id: '107_Load', displayName: '107' },
              { id: '108_Load', displayName: '108' },
              { id: '109_Load', displayName: '109' },
              { id: '110_Load', displayName: '110' }
            ]);
          }
        } else {
          toast({
            title: "Error loading shelves",
            description: data.error || "Failed to load available shelves",
            variant: "destructive",
          });
          // Demo data
          setShelves([
            { id: '107_Load', displayName: '107' },
            { id: '108_Load', displayName: '108' },
            { id: '109_Load', displayName: '109' },
            { id: '110_Load', displayName: '110' }
          ]);
        }
      } catch (error) {
        toast({
          title: "Connection error",
          description: "Could not connect to server",
          variant: "destructive",
        });
        // Demo data
        setShelves([
          { id: '107_Load', displayName: '107' },
          { id: '108_Load', displayName: '108' },
          { id: '109_Load', displayName: '109' },
          { id: '110_Load', displayName: '110' }
        ]);
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