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
import LoginPage from './admin/1LoginPage';
import AdminLayout from './admin/1AdminLayout';
import AdminDashboard from './admin/1AdminDashboard';
import RobotRegistration from './admin/1RobotRegistration';
import RobotAssignment from './admin/1RobotAssignment';

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
  const isAdminAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';

  // Admin routes should be handled separately
  if (window.location.pathname.startsWith('/admin')) {
    return (
      <Switch>
        <Route path="/admin/login" component={LoginPage} />
        <Route 
          path="/admin/dashboard" 
          component={() => (
            isAdminAuthenticated ? (
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            ) : (
              <Redirect to="/admin/login" />
            )
          )} 
        />
        <Route 
          path="/admin/robot-registration" 
          component={() => (
            isAdminAuthenticated ? (
              <AdminLayout>
                <RobotRegistration />
              </AdminLayout>
            ) : (
              <Redirect to="/admin/login" />
            )
          )} 
        />
        <Route 
          path="/admin/robot-assignment" 
          component={() => (
            isAdminAuthenticated ? (
              <AdminLayout>
                <RobotAssignment />
              </AdminLayout>
            ) : (
              <Redirect to="/admin/login" />
            )
          )} 
        />
        <Route path="/admin/*" component={() => <Redirect to="/admin/login" />} />
      </Switch>
    );
  }

  // Regular app routes - redirect all to admin login
  return (
    <Switch>
      <Route path="/*" component={() => <Redirect to="/admin/login" />} />
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
