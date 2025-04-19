import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { 
  ToyBrick, 
  PanelsTopLeft, 
  Laptop, 
  Gauge, 
  Map, 
  History, 
  Settings, 
  PersonStanding,
  LayoutTemplate,
  Palette,
  ChevronDown,
  ChevronRight,
  Bot,
  BrainCircuit,
  ListTodo
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  // Base navigation items for all users
  const baseNavItems = [
    { href: "/", label: "Dashboard", icon: <PanelsTopLeft className="mr-3 h-5 w-5" /> },
    { href: "/control-panel", label: "Control Panel", icon: <Laptop className="mr-3 h-5 w-5" /> },
    { href: "/sensor-data", label: "Sensor Data", icon: <Gauge className="mr-3 h-5 w-5" /> },
    { href: "/navigation", label: "Navigation", icon: <Map className="mr-3 h-5 w-5" /> },
    { href: "/history", label: "History", icon: <History className="mr-3 h-5 w-5" /> },
    { href: "/ai-assistant", label: "AI Assistant", icon: <BrainCircuit className="mr-3 h-5 w-5" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];
  
  // Add My Template for non-admin users
  const navItems = user?.role === 'admin' 
    ? baseNavItems 
    : [...baseNavItems, { href: "/my-template", label: "My Template", icon: <Palette className="mr-3 h-5 w-5" /> }];

  // Admin-specific navigation items
  const adminNavItems = user?.role === 'admin' ? [
    {
      label: "Templates",
      icon: <LayoutTemplate className="mr-3 h-5 w-5" />,
      items: [
        { href: "/templates", label: "Template Manager" },
        { href: "/admin-templates", label: "Admin Templates" }
      ]
    },
    {
      label: "Robots",
      icon: <Bot className="mr-3 h-5 w-5" />,
      items: [
        { href: "/robot-assignments", label: "Robot Assignments" },
        { href: "/robot-hub", label: "Robot Monitoring Hub" },
        { href: "/robot-tasks", label: "Task Queue" }
      ]
    }
  ] : [];

  return (
    <div className="w-64 bg-white shadow-md overflow-y-auto h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center">
          <div className="rounded-full bg-primary w-10 h-10 flex items-center justify-center text-white">
            <ToyBrick className="h-6 w-6" />
          </div>
          <h1 className="ml-3 text-xl font-medium">AxBot Control</h1>
        </div>
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
                    : "text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}

          {adminNavItems.length > 0 && (
            <>
              <li className="px-4 py-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </div>
              </li>
              {adminNavItems.map((item, index) => (
                <li key={`admin-${index}`}>
                  <button
                    onClick={() => setOpenDropdowns(prev => ({
                      ...prev, 
                      [`admin-${index}`]: !prev[`admin-${index}`]
                    }))}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 hover:bg-accent hover:text-accent-foreground",
                      item.items.some(subItem => location === subItem.href)
                        ? "bg-primary/20 text-primary"
                        : "text-foreground"
                    )}
                  >
                    <div className="flex items-center">
                      {item.icon}
                      {item.label}
                    </div>
                    {openDropdowns[`admin-${index}`] ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </button>
                  
                  {openDropdowns[`admin-${index}`] && (
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
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <PersonStanding className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">{user?.username || 'Guest'}</p>
            <p className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
