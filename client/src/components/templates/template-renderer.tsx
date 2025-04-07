import React from 'react';
import { User } from '@shared/schema';
import { Loader2, Trash2, ShowerHead, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

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
      {/* Small Skytech Logo in top-left */}
      <div className="absolute top-4 left-4 text-xs font-bold">
        Skytech
      </div>
      
      {/* Logout Button */}
      <button 
        className="absolute top-4 right-4 cursor-pointer hover:opacity-80"
        onClick={() => logoutMutation.mutate()}
        aria-label="Logout"
      >
        <LogOut className="h-6 w-6 text-red-600" />
      </button>
      
      {/* Center content */}
      <div className="pt-16 pb-8 px-4 flex flex-col items-center gap-6">
        {layout.components.filter(comp => comp.type === 'rectangle').map((component, index) => (
          <button
            key={index}
            className="w-full max-w-[200px] aspect-square rounded-lg relative flex flex-col items-center justify-center 
                     shadow-md hover:shadow-lg transform hover:translate-y-[-2px] transition-all"
            style={{
              backgroundColor: component.color || layout.primaryColor,
            }}
          >
            {component.icon === 'trash' && (
              <Trash2 className="h-16 w-16 text-white mb-2" />
            )}
            {component.icon === 'laundry' && (
              <ShowerHead className="h-16 w-16 text-white mb-2" />
            )}
            {component.label && (
              <div className="text-white font-semibold text-xl">
                {component.label}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}