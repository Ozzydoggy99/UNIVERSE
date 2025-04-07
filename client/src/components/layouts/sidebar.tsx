import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { ToyBrick, PanelsTopLeft, Laptop, Gauge, Map, History, Settings, PersonStanding } from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "PanelsTopLeft", icon: <PanelsTopLeft className="mr-3 h-5 w-5" /> },
    { href: "/control-panel", label: "Control Panel", icon: <Laptop className="mr-3 h-5 w-5" /> },
    { href: "/sensor-data", label: "Sensor Data", icon: <Gauge className="mr-3 h-5 w-5" /> },
    { href: "/navigation", label: "Navigation", icon: <Map className="mr-3 h-5 w-5" /> },
    { href: "/history", label: "History", icon: <History className="mr-3 h-5 w-5" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];

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
              <Link href={item.href}>
                <a
                  className={cn(
                    "flex items-center px-4 py-3 hover:bg-accent hover:text-accent-foreground",
                    location === item.href
                      ? "bg-primary/20 text-primary"
                      : "text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="absolute bottom-0 w-64 p-4 border-t border-border">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <PersonStanding className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
