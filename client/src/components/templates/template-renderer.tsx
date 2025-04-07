import React from 'react';
import { User } from '@shared/schema';
import { Loader2, Trash2, ShowerHead } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

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
    <div className="template-container h-full">
      {layout.components.map((component, index) => {
        switch (component.type) {
          case 'header':
            return (
              <div 
                key={index} 
                className="text-center p-4 text-2xl font-bold"
                style={{ 
                  color: layout.primaryColor,
                  background: layout.secondaryColor
                }}
              >
                {component.content}
              </div>
            );
          case 'rectangle':
            return (
              <div
                key={index}
                className="mx-auto w-full max-w-md my-2 relative flex flex-col items-center justify-center"
                style={{
                  height: `${component.height || 100}px`,
                  backgroundColor: component.color || layout.primaryColor,
                }}
              >
                {component.icon === 'trash' && (
                  <Trash2 className="h-12 w-12 text-white mb-2" />
                )}
                {component.icon === 'laundry' && (
                  <ShowerHead className="h-12 w-12 text-white mb-2" />
                )}
                {component.label && (
                  <div className="text-white font-semibold text-lg">
                    {component.label}
                  </div>
                )}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}