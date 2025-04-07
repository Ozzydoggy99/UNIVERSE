import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ControlPanel from "@/pages/control-panel";
import SensorData from "@/pages/sensor-data";
import Navigation from "@/pages/navigation";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import Sidebar from "@/components/layouts/sidebar";
import TopBar from "@/components/layouts/top-bar";
import { AuthProvider } from "@/hooks/use-auth";
import { RobotProvider } from "@/providers/robot-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { TemplateManager } from "@/components/templates/template-manager";
import { TemplateRenderer } from "@/components/templates/template-renderer";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-neutral-light p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute 
        path="/" 
        component={() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )} 
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
        path="/my-template" 
        component={({ user }) => (
          <AppLayout>
            <div className="h-full">
              <TemplateRenderer user={user} />
            </div>
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
