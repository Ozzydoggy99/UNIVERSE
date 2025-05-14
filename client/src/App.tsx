import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ControlPanel from "@/pages/control-panel";
import SensorData from "@/pages/sensor-data";
import Navigation from "@/pages/navigation";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import AdminTemplates from "@/pages/admin-templates";
import AdminTasks from "@/pages/admin-tasks";
import RobotAssignments from "@/pages/robot-assignments";
import RobotHub from "@/pages/robot-hub";
import FixedRobotDetails from "@/pages/fixed-robot-details";
import RobotDetails from "@/pages/robot-details";
import UnassignedRobots from "@/pages/unassigned-robots";
import AIAssistantPage from "@/pages/ai-assistant";
import RobotTasks from "@/pages/robot-tasks";
import MapTestPage from "@/pages/map-test-page";
import MapDataTestPage from "@/pages/map-data-test";
import LayeredMapPage from "@/pages/layered-map-page";
import PowerCycleTestPage from "@/pages/power-cycle-test";
import RobotInstaller from "@/pages/robot-installer";
import InstallerDebugPage from "@/pages/installer-debug";
import MyTemplate from "@/pages/my-template";
import RemoteExecutor from "@/pages/remote-executor";
import RobotMapsPage from "@/pages/robot-maps-page";
import RobotMissionPage from "@/pages/robot-mission-page";
import RobotDashboardPage from "@/pages/robot-dashboard";
import WsDebugPage from "@/pages/ws-debug";
import ServiceSelectionPage, {
  OperationSelectionPage,
  FloorSelectionPage as SimplifiedFloorPage,
  ShelfSelectionPage as SimplifiedShelfPage
} from "@/pages/simplified-workflow";
import Sidebar, { SidebarProvider, useSidebar } from "@/components/layouts/sidebar";
import TopBar from "@/components/layouts/top-bar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { RobotProvider } from "@/providers/robot-provider";
import { ProtectedRoute } from "@/lib/protected-route";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const isAdmin = user?.role === 'admin';
  
  // For non-admin users, render just the content without sidebar or topbar
  if (!isAdmin) {
    return (
      <div className="h-screen overflow-auto">
        <main className="h-full">
          {children}
        </main>
      </div>
    );
  }
  
  // For admin users, render the full layout with sidebar and topbar
  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
      
      {/* Sidebar - using our toggleable sidebar */}
      <div className={`md:translate-x-0 transform transition-transform duration-200 ease-in-out fixed md:static inset-y-0 left-0 z-30 md:z-auto h-full overflow-y-auto ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <Sidebar />
      </div>
      
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        isCollapsed ? 'md:ml-16' : 'md:ml-0'
      }`}>
        <TopBar 
          onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)} 
          isSidebarOpen={mobileMenuOpen} 
        />
        <main className="flex-1 overflow-y-auto bg-neutral-light p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  const { user } = useAuth();

  // If user is not admin, redirect from home to my-template
  const HomeComponent = () => {
    if (user && user.role !== 'admin') {
      return <Redirect to="/my-template" />;
    }
    
    return (
      <AppLayout>
        <Dashboard />
      </AppLayout>
    );
  };

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute 
        path="/" 
        component={HomeComponent} 
      />
      
      <ProtectedRoute 
        path="/control-panel" 
        component={() => (
          <AppLayout>
            <ControlPanel />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/sensor-data" 
        component={() => (
          <AppLayout>
            <SensorData />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/navigation" 
        component={() => (
          <AppLayout>
            <Navigation />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/history" 
        component={() => (
          <AppLayout>
            <History />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/settings" 
        component={() => (
          <AppLayout>
            <Settings />
          </AppLayout>
        )} 
      />
      
      {/* Legacy template management routes removed */}
      
      <ProtectedRoute 
        path="/admin-tasks" 
        component={() => (
          <AppLayout>
            <AdminTasks />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/robot-details/:serialNumber" 
        component={() => (
          <AppLayout>
            <RobotDetails />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/my-template" 
        component={() => (
          <div className="h-full min-h-screen">
            {/* Using our new simplified template UI */}
            <MyTemplate />
          </div>
        )} 
      />
      
      {/* All legacy numbered-boxes, laundry-boxes, trash-boxes routes removed
       * All service-specific routes for laundry/pickup-dropoff, trash/pickup-dropoff removed
       * All service-specific numbered box pages removed
       * All unit boxes pages removed
       */}
      

      {/* AI Assistant */}
      <ProtectedRoute 
        path="/ai-assistant" 
        component={() => (
          <AppLayout>
            <AIAssistantPage />
          </AppLayout>
        )} 
      />
      
      {/* Robot Task Queue */}
      <ProtectedRoute 
        path="/robot-tasks" 
        component={() => (
          <AppLayout>
            <RobotTasks />
          </AppLayout>
        )} 
      />
      
      {/* WebSocket Debug Page */}
      <ProtectedRoute 
        path="/ws-debug" 
        component={() => (
          <AppLayout>
            <WsDebugPage />
          </AppLayout>
        )} 
      />

      {/* Map Test Page */}
      <ProtectedRoute 
        path="/map-test/:serialNumber?" 
        component={() => (
          <AppLayout>
            <MapTestPage />
          </AppLayout>
        )} 
      />
      
      {/* Map Data Test Page */}
      <ProtectedRoute 
        path="/map-data-test" 
        component={() => (
          <AppLayout>
            <MapDataTestPage />
          </AppLayout>
        )} 
      />
      
      {/* Layered Map Builder */}
      <ProtectedRoute 
        path="/layered-map/:serialNumber" 
        component={() => (
          <LayeredMapPage />
        )} 
      />
      
      {/* Power Cycle Test Page */}
      <ProtectedRoute 
        path="/power-cycle-test" 
        component={() => (
          <AppLayout>
            <PowerCycleTestPage />
          </AppLayout>
        )} 
      />
      
      {/* Robot AI Installer */}
      <Route 
        path="/robot-ai-installer" 
        component={RobotInstaller} 
      />
      
      {/* Installer Debug Page */}
      <Route 
        path="/installer-debug" 
        component={InstallerDebugPage} 
      />
      
      {/* Remote Command Executor */}
      <Route 
        path="/remote-executor" 
        component={() => (
          <AppLayout>
            <RemoteExecutor />
          </AppLayout>
        )} 
      />
      
      {/* Maps For Robots Page */}
      <ProtectedRoute 
        path="/robot-maps" 
        component={() => (
          <AppLayout>
            <RobotMapsPage />
          </AppLayout>
        )} 
      />

      {/* Maps shortcut URL */}
      <ProtectedRoute 
        path="/maps" 
        component={() => (
          <AppLayout>
            <RobotMapsPage />
          </AppLayout>
        )} 
      />
      
      {/* Robot Mission Page */}
      <ProtectedRoute 
        path="/robot-mission" 
        component={() => (
          <AppLayout>
            <RobotMissionPage />
          </AppLayout>
        )} 
      />
      
      {/* Robot Real-time Dashboard */}
      <ProtectedRoute 
        path="/robot-dashboard" 
        component={() => (
          <AppLayout>
            <RobotDashboardPage />
          </AppLayout>
        )} 
      />

      {/* Legacy Dynamic Workflow UI Routes removed - now using simplified workflow */}
      
      {/* Simplified Workflow UI Routes - new user interface with automatic discovery */}
      <ProtectedRoute 
        path="/simplified-workflow" 
        component={() => (
          <AppLayout>
            <ServiceSelectionPage />
          </AppLayout>
        )} 
      />
      <ProtectedRoute 
        path="/simplified-workflow/operations" 
        component={() => (
          <AppLayout>
            <OperationSelectionPage />
          </AppLayout>
        )} 
      />
      <ProtectedRoute 
        path="/simplified-workflow/:serviceType" 
        component={() => (
          <AppLayout>
            <OperationSelectionPage />
          </AppLayout>
        )} 
      />
      <ProtectedRoute 
        path="/simplified-workflow/:serviceType/:operationType" 
        component={() => (
          <AppLayout>
            <SimplifiedFloorPage />
          </AppLayout>
        )} 
      />
      <ProtectedRoute 
        path="/simplified-workflow/:serviceType/:operationType/:floorId" 
        component={() => (
          <AppLayout>
            <SimplifiedShelfPage />
          </AppLayout>
        )} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RobotProvider>
          <SidebarProvider>
            <Router />
          </SidebarProvider>
        </RobotProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
