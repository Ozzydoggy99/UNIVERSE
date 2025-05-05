import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { 
  ToyBrick, 
  PanelsTopLeft, 
  Laptop, 
  Gauge, 
  Map as MapIcon, 
  History, 
  Settings, 
  PersonStanding,
  LayoutTemplate,
  Palette,
  ChevronDown,
  ChevronRight,
  Bot,
  BrainCircuit,
  ListTodo,
  Terminal,
  PanelLeft,
  Menu
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// Create a sidebar context to manage the state globally
import React from "react";
export const SidebarContext = React.createContext<{
  isCollapsed: boolean;
  toggleSidebar: () => void;
}>({
  isCollapsed: false,
  toggleSidebar: () => {},
});

export const useSidebar = () => React.useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Check if we should use collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState) {
      setIsCollapsed(savedState === "true");
    }
  }, []);

  // Toggle sidebar collapsed state
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const { isCollapsed, toggleSidebar } = useSidebar();

  // Base navigation items for all users
  const baseNavItems = [
    { href: "/", label: "Dashboard", icon: <PanelsTopLeft className="h-5 w-5" /> },
    { href: "/control-panel", label: "Control Panel", icon: <Laptop className="h-5 w-5" /> },
    { href: "/sensor-data", label: "Sensor Data", icon: <Gauge className="h-5 w-5" /> },
    { href: "/navigation", label: "Navigation", icon: <MapIcon className="h-5 w-5" /> },
    { href: "/history", label: "History", icon: <History className="h-5 w-5" /> },
    { href: "/ai-assistant", label: "AI Assistant", icon: <BrainCircuit className="h-5 w-5" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];
  
  // Add My Template for non-admin users
  const navItems = user?.role === 'admin' 
    ? baseNavItems 
    : [...baseNavItems, { href: "/my-template", label: "My Template", icon: <Palette className="h-5 w-5" /> }];

  // Admin-specific navigation items
  const adminNavItems = user?.role === 'admin' ? [
    {
      label: "Templates",
      icon: <LayoutTemplate className="h-5 w-5" />,
      items: [
        { href: "/templates", label: "Template Manager" },
        { href: "/admin-templates", label: "Admin Templates" }
      ]
    },
    {
      label: "Robots",
      icon: <Bot className="h-5 w-5" />,
      items: [
        { href: "/robot-assignments", label: "Robot Assignments" },
        { href: "/robot-hub", label: "Robot Monitoring Hub" },
        { href: "/robot-maps", label: "Maps For Robots" },
        { href: "/robot-tasks", label: "Task Queue" },
        { href: "/remote-executor", label: "Remote Executor" }
      ]
    }
  ] : [];

  return (
    <div 
      className={cn(
        "bg-white shadow-md overflow-y-auto h-full flex flex-col transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        {!isCollapsed ? (
          <div className="flex items-center">
            <div className="rounded-full bg-primary w-10 h-10 flex items-center justify-center text-white">
              <ToyBrick className="h-6 w-6" />
            </div>
            <h1 className="ml-3 text-xl font-medium">AxBot Control</h1>
          </div>
        ) : (
          <div className="rounded-full bg-primary w-10 h-10 flex items-center justify-center text-white mx-auto">
            <ToyBrick className="h-6 w-6" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(!isCollapsed && "ml-1")} 
          onClick={toggleSidebar}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <nav className="mt-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}
                className={cn(
                  "flex items-center px-4 py-3 hover:bg-accent hover:text-accent-foreground",
                  location === item.href
                    ? "bg-primary/20 text-primary"
                    : "text-foreground",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={cn(isCollapsed ? "mx-auto" : "mr-3")}>
                  {item.icon}
                </div>
                {!isCollapsed && item.label}
              </Link>
            </li>
          ))}

          {adminNavItems.length > 0 && (
            <>
              {!isCollapsed && (
                <li className="px-4 py-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </div>
                </li>
              )}
              {adminNavItems.map((item, index) => (
                <li key={`admin-${index}`}>
                  <button
                    onClick={() => !isCollapsed && setOpenDropdowns(prev => ({
                      ...prev, 
                      [`admin-${index}`]: !prev[`admin-${index}`]
                    }))}
                    className={cn(
                      "flex items-center w-full py-3 hover:bg-accent hover:text-accent-foreground",
                      item.items.some(subItem => location === subItem.href)
                        ? "bg-primary/20 text-primary"
                        : "text-foreground",
                      isCollapsed ? "justify-center px-0" : "px-4 justify-between"
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className={cn("flex items-center", isCollapsed && "justify-center")}>
                      <div className={cn(isCollapsed ? "mx-auto" : "mr-3")}>
                        {item.icon}
                      </div>
                      {!isCollapsed && item.label}
                    </div>
                    {!isCollapsed && (
                      openDropdowns[`admin-${index}`] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {!isCollapsed && openDropdowns[`admin-${index}`] && (
                    <ul className="ml-4 pl-3 border-l border-border">
                      {item.items.map((subItem) => (
                        <li key={subItem.href}>
                          <Link href={subItem.href}
                            className={cn(
                              "flex items-center px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                              location === subItem.href
                                ? "text-primary font-medium"
                                : "text-foreground"
                            )}
                          >
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>
      <div className="mt-auto p-4 border-t border-border">
        {!isCollapsed ? (
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <PersonStanding className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.username || 'Guest'}</p>
              <p className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <PersonStanding className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
