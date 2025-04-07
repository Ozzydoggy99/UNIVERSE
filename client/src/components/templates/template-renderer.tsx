import React from 'react';
import { User } from '@shared/schema';
import { Loader2, Trash2, ShowerHead, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface TemplateRendererProps {
  user: User | null;
}

interface TemplateComponent {
  type: string;
  color?: string;
  height?: number;
  position?: string;
  content?: string;
  icon?: string;
  label?: string;
}

interface TemplateLayout {
  primaryColor: string;
  secondaryColor: string;
  components: TemplateComponent[];
}

export function TemplateRenderer({ user }: TemplateRendererProps) {
  console.log("User in template renderer:", user);
  const { logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: template, isLoading, error } = useQuery({
    queryKey: ['/api/templates', user?.templateId],
    queryFn: async () => {
      if (!user?.templateId) {
        throw new Error("No template ID provided");
      }
      console.log("Fetching template with ID:", user.templateId);
      
      // Get the specific template by ID
      const response = await fetch(`/api/templates/${user.templateId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch template");
      }
      return response.json();
    },
    enabled: !!user?.templateId,
  });
  
  console.log("Template data:", template);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">No Template Available</h2>
          <p className="text-gray-500">
            {error ? 'Error loading template' : 'No template assigned to this user'}
          </p>
        </Card>
      </div>
    );
  }

  // Parse the layout JSON
  let layout: TemplateLayout;
  try {
    // Safely check if template.layout exists before parsing
    if (!template.layout) {
      throw new Error("Template layout is empty");
    }
    layout = JSON.parse(template.layout);
  } catch (e) {
    console.error("Template parsing error:", e);
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Template Error</h2>
          <p className="text-gray-500">Could not parse template layout: {String(e)}</p>
        </Card>
      </div>
    );
  }

  // Render the template components
  return (
    <div className="template-container h-full relative">
      {/* Skytech Logo in top-left */}
      <div className="absolute top-4 left-4 text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent px-2 py-1 border-l-2 border-green-500">
        SKYTECH
      </div>
      
      {/* Logout Button */}
      <button 
        className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition-transform"
        onClick={() => logoutMutation.mutate()}
        aria-label="Logout"
      >
        <LogOut className="h-6 w-6 text-red-600 drop-shadow-glow-red" />
      </button>
      
      {/* Center content */}
      <div className="pt-16 pb-8 px-4 flex flex-col items-center gap-6">
        {layout.components.filter(comp => comp.type === 'rectangle').map((component, index) => (
          <button
            key={index}
            className="w-full max-w-[200px] aspect-square rounded-lg relative flex flex-col items-center justify-center 
                     shadow-md hover:shadow-lg transform hover:translate-y-[-2px] transition-all
                     border-2 border-white/30 overflow-hidden"
            style={{
              backgroundColor: component.color || layout.primaryColor,
            }}
            onClick={() => {
              if (component.icon === 'laundry') {
                navigate('/laundry-boxes');
              } else if (component.icon === 'trash') {
                navigate('/trash-boxes');
              } else {
                navigate('/numbered-boxes');
              }
            }}
          >
            <div className="absolute inset-0 border-4 border-white/10 rounded-lg pointer-events-none"></div>
            {component.icon === 'trash' && (
              <Trash2 className="h-16 w-16 text-white mb-2 drop-shadow-md" />
            )}
            {component.icon === 'laundry' && (
              <ShowerHead className="h-16 w-16 text-white mb-2 drop-shadow-md" />
            )}
            {component.label && (
              <div className="text-white font-bold text-xl tracking-wide px-4 py-1.5 bg-black/20 rounded-md shadow-inner border border-white/20 text-shadow-sm">
                {component.label}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-black/30 to-transparent"></div>
          </button>
        ))}
      </div>
    </div>
  );
}