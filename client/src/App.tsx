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
import Sidebar from "@/components/layouts/sidebar";
import TopBar from "@/components/layouts/top-bar";
import { AuthProvider } from "@/providers/auth-provider";
import { RobotProvider } from "@/providers/robot-provider";

function Router() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-neutral-light p-4">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/control-panel" component={ControlPanel} />
            <Route path="/sensor-data" component={SensorData} />
            <Route path="/navigation" component={Navigation} />
            <Route path="/history" component={History} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
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
