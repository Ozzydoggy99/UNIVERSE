import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
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
  Palette
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: <PanelsTopLeft className="mr-3 h-5 w-5" /> },
    { href: "/control-panel", label: "Control Panel", icon: <Laptop className="mr-3 h-5 w-5" /> },
    { href: "/sensor-data", label: "Sensor Data", icon: <Gauge className="mr-3 h-5 w-5" /> },
    { href: "/navigation", label: "Navigation", icon: <Map className="mr-3 h-5 w-5" /> },
    { href: "/history", label: "History", icon: <History className="mr-3 h-5 w-5" /> },
    { href: "/my-template", label: "My Template", icon: <Palette className="mr-3 h-5 w-5" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];

  // Add Template Manager link for admins only
  const adminNavItems = user?.role === 'admin' ? [
    { href: "/templates", label: "Template Manager", icon: <LayoutTemplate className="mr-3 h-5 w-5" /> }
  ] : [];

  return (
    <div className="w-64 bg-white shadow-md hidden md:block overflow-y-auto">
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
              {adminNavItems.map((item) => (
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
            </>
          )}
        </ul>
      </nav>
      <div className="absolute bottom-0 w-64 p-4 border-t border-border">
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
