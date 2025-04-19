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
import RobotAssignments from "@/pages/robot-assignments";
import RobotHub from "@/pages/robot-hub";
import RobotDetails from "@/pages/robot-details";
import UnassignedRobots from "@/pages/unassigned-robots";
import NumberedBoxes from "@/pages/numbered-boxes";
import LaundryBoxes from "@/pages/laundry-boxes";
import TrashBoxes from "@/pages/trash-boxes";
import PickupDropoffPage from "@/pages/pickup-dropoff-page";
import UnitBoxes from "@/pages/unit-boxes";
import AIAssistantPage from "@/pages/ai-assistant";
import RobotTasks from "@/pages/robot-tasks";
import Game from "@/pages/game";
import Sidebar from "@/components/layouts/sidebar";
import TopBar from "@/components/layouts/top-bar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { RobotProvider } from "@/providers/robot-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { TemplateManager } from "@/components/templates/template-manager";
import { TemplateRenderer } from "@/components/templates/template-renderer";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
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
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transform transition-transform duration-200 ease-in-out fixed md:static inset-y-0 left-0 z-30 md:z-auto w-64 bg-white h-full overflow-y-auto`}>
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
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
      
      <ProtectedRoute 
        path="/templates" 
        component={() => (
          <AppLayout>
            <TemplateManager />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/admin-templates" 
        component={AdminTemplates} 
      />
      
      <ProtectedRoute 
        path="/robot-assignments" 
        component={() => (
          <AppLayout>
            <RobotAssignments />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/robot-hub" 
        component={() => (
          <AppLayout>
            <RobotHub />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/unassigned-robots" 
        component={() => (
          <AppLayout>
            <UnassignedRobots />
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
        path="/templates/:id" 
        component={() => {
          const TemplateDetail = React.lazy(() => import('@/pages/template-detail'));
          return (
            <React.Suspense fallback={<div>Loading...</div>}>
              <TemplateDetail />
            </React.Suspense>
          );
        }} 
      />
      
      <ProtectedRoute 
        path="/my-template" 
        component={({ user }) => (
          <AppLayout>
            <div className="h-full">
              <TemplateRenderer user={user} />
            </div>
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/numbered-boxes" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <NumberedBoxes user={user} />
          </div>
        )} 
      />
      
      {/* First Level UI Pages */}
      <ProtectedRoute 
        path="/laundry-boxes" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <LaundryBoxes user={user} />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash-boxes" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <TrashBoxes user={user} />
          </div>
        )} 
      />

      {/* Pickup/Dropoff Pages */}
      <ProtectedRoute 
        path="/laundry/pickup-dropoff" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <PickupDropoffPage user={user} type="laundry" />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash/pickup-dropoff" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <PickupDropoffPage user={user} type="trash" />
          </div>
        )} 
      />

      {/* Service-specific Numbered Box Pages */}
      <ProtectedRoute 
        path="/laundry/pickup/numbers" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <NumberedBoxes user={user} serviceType="laundry" actionType="pickup" />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/laundry/dropoff/numbers" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <NumberedBoxes user={user} serviceType="laundry" actionType="dropoff" />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash/pickup/numbers" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <NumberedBoxes user={user} serviceType="trash" actionType="pickup" />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash/dropoff/numbers" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <NumberedBoxes user={user} serviceType="trash" actionType="dropoff" />
          </div>
        )} 
      />
      
      {/* Unit Boxes Pages - for floor-specific units in the hundreds */}
      <ProtectedRoute 
        path="/laundry/pickup/floor/:floorNumber/units" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <UnitBoxes user={user} />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/laundry/dropoff/floor/:floorNumber/units" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <UnitBoxes user={user} />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash/pickup/floor/:floorNumber/units" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <UnitBoxes user={user} />
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/trash/dropoff/floor/:floorNumber/units" 
        component={({ user }) => (
          <div className="h-full min-h-screen">
            <UnitBoxes user={user} />
          </div>
        )} 
      />
      
      {/* Game */}
      <ProtectedRoute 
        path="/game" 
        component={Game} 
      />
      
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RobotProvider>
          <Router />
        </RobotProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
