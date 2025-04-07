import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/dialogs/auth-dialog";
import { refreshAllData } from "@/lib/api";
import { useRobot } from "@/providers/robot-provider";
import { useAuth } from "@/providers/auth-provider";
import { Menu, Bell, RefreshCw, Lock } from "lucide-react";

const getPageTitle = (location: string): string => {
  const routes: Record<string, string> = {
    "/": "Dashboard",
    "/control-panel": "Control Panel",
    "/sensor-data": "Sensor Data",
    "/navigation": "Navigation",
    "/history": "History",
    "/settings": "Settings",
  };
  
  return routes[location] || "Not Found";
};

export default function TopBar() {
  const [location] = useLocation();
  const { isAuthenticated, showAuthDialog, setShowAuthDialog } = useAuth();
  const { setRobotData } = useRobot();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [status, position, sensorData, mapData] = await refreshAllData();
      setRobotData(status, position, sensorData, mapData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <button className="md:hidden text-foreground mr-4">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-medium md:hidden">AxBot Control</h1>
            <h1 className="text-xl font-medium hidden md:block">{getPageTitle(location)}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-primary" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant={isAuthenticated ? "ghost" : "default"} 
              onClick={() => setShowAuthDialog(true)}
              className="flex items-center"
            >
              <Lock className="mr-1 h-4 w-4" />
              {isAuthenticated ? "Authenticated" : "Authenticate"}
            </Button>
          </div>
        </div>
      </header>
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
