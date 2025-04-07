import React from 'react';
import { User } from '@shared/schema';
import { Loader2 } from 'lucide-react';
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
}

interface TemplateLayout {
  primaryColor: string;
  secondaryColor: string;
  components: TemplateComponent[];
}

export function TemplateRenderer({ user }: TemplateRendererProps) {
  const { data: template, isLoading, error } = useQuery({
    queryKey: ['/api/templates', user?.templateId],
    enabled: !!user?.templateId,
  });

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
    layout = JSON.parse(template.layout);
  } catch (e) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Template Error</h2>
          <p className="text-gray-500">Could not parse template layout</p>
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
                className="mx-auto w-full max-w-md my-2"
                style={{
                  height: `${component.height || 100}px`,
                  backgroundColor: component.color || layout.primaryColor,
                }}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}