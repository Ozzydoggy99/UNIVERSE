import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { refreshAllData } from "@/lib/api";
import { useRobot } from "@/providers/robot-provider";
import { useAuth } from "@/hooks/use-auth";
import { Menu, Bell, RefreshCw, LogOut } from "lucide-react";
import { RobotStatus, RobotPosition, RobotSensorData, MapData } from "@/types/robot";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface TopBarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function TopBar({ onToggleSidebar, isSidebarOpen }: TopBarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { setRobotData } = useRobot();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMobile = useIsMobile();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await refreshAllData();
      // Correctly type the data array
      const [status, position, sensorData, mapData] = data as [
        RobotStatus,
        RobotPosition,
        RobotSensorData,
        MapData
      ];
      setRobotData(status, position, sensorData, mapData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm z-10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center">
          <button 
            className="md:hidden text-foreground mr-4" 
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-medium md:hidden">Skytech Automated</h1>
          <h1 className="text-xl font-medium hidden md:block">{getPageTitle(location)}</h1>
        </div>
        <div className="flex items-center space-x-4">
          {user && (
            <>
              <span className="text-sm text-muted-foreground hidden md:inline">
                Welcome, <span className="font-medium">{user.username}</span>
              </span>
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
                variant="ghost" 
                onClick={handleLogout}
                className="flex items-center"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
