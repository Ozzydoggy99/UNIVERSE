import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocation, Link } from 'wouter';
import { Loader2, LayoutTemplate, ArrowLeft, Users, Trash, ShowerHead } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { UITemplate, User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function TemplateDetail() {
  const [location] = useLocation();
  const match = location.match(/\/templates\/(\d+)/);
  const templateId = match ? parseInt(match[1]) : null;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  interface TemplateComponent {
    type: string;
    icon: string;
    label: string;
    color: string;
    floors: number;
  }
  
  interface TemplateConfig {
    primaryColor: string;
    secondaryColor: string;
    components: TemplateComponent[];
  }
  
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({
    primaryColor: '#228B22',
    secondaryColor: '#000000',
    components: [],
  });

  // If not logged in or not admin, redirect
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  // If no template ID, redirect to templates page
  if (!templateId) {
    return <Redirect to="/admin-templates" />;
  }

  // Fetch template details
  const { data: template, isLoading: templateLoading } = useQuery<UITemplate>({
    queryKey: ['/api/templates', templateId],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${templateId}`);
      if (!res.ok) throw new Error('Failed to fetch template');
      return res.json();
    },
  });

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Get users assigned to this template
  const assignedUsers = users.filter(u => u.templateId === templateId);

  // Parse template layout
  useEffect(() => {
    if (template?.layout) {
      try {
        const parsed = JSON.parse(template.layout);
        setTemplateConfig(parsed);
      } catch (e) {
        console.error("Failed to parse template layout:", e);
      }
    }
  }, [template]);

  // Assign template to user
  const assignMutation = useMutation({
    mutationFn: async (data: { userId: number; templateId: number }) => {
      const res = await apiRequest('PUT', `/api/users/${data.userId}/template`, { templateId: data.templateId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template assigned',
        description: 'The template has been assigned to the user successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setSelectedUserId("");
      setIsSubmitting(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error assigning template',
        description: error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
  });

  // Remove template from user
  const unassignMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('PUT', `/api/users/${userId}/template`, { templateId: null });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template unassigned',
        description: 'The template has been removed from the user successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error unassigning template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update template component (floors)
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<UITemplate> }) => {
      const res = await apiRequest('PUT', `/api/templates/${data.id}`, data.updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template updated',
        description: 'The floor configuration has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates', templateId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAssign = () => {
    if (!selectedUserId || !templateId) return;
    
    setIsSubmitting(true);
    assignMutation.mutate({
      userId: parseInt(selectedUserId),
      templateId: templateId
    });
  };

  const handleUnassign = (userId: number) => {
    if (window.confirm("Are you sure you want to remove this template from this user?")) {
      unassignMutation.mutate(userId);
    }
  };

  // Function to update component's floors count
  const updateComponentFloors = (index: number, floors: number) => {
    if (!template) return;
    
    const updatedConfig = { ...templateConfig };
    updatedConfig.components[index].floors = Math.max(1, Math.min(99, floors));
    
    // Update the template with the new layout
    updateTemplateMutation.mutate({
      id: template.id,
      updates: {
        layout: JSON.stringify(updatedConfig)
      }
    });
  };

  if (templateLoading) {
    return (
      <div className="min-h-screen bg-neutral-light flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <header className="bg-white shadow-sm p-4 mb-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <LayoutTemplate className="text-primary h-6 w-6 mr-2" />
            <h1 className="text-xl font-bold">Template Details</h1>
          </div>
          <div className="flex space-x-2">
            <Link href="/admin-templates">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {template && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{template.name}</h2>
                <p className="text-gray-500">{template.description}</p>
              </div>
              <Badge variant={template.isActive ? "default" : "secondary"} className={template.isActive ? "bg-green-500" : ""}>
                {template.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Assignment Section */}
              <Card className="p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  User Assignments
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="user" className="mb-2 block">Assign to User</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter(u => !u.templateId || u.templateId !== templateId)
                            .map(user => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.username} {user.role === 'admin' ? '(Admin)' : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleAssign} 
                      disabled={!selectedUserId || isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Assign
                    </Button>
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-sm">Username</th>
                          <th className="px-4 py-2 text-left font-medium text-sm">Role</th>
                          <th className="px-4 py-2 text-right font-medium text-sm"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedUsers.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              No users assigned to this template
                            </td>
                          </tr>
                        ) : (
                          assignedUsers.map(u => (
                            <tr key={u.id} className="border-t">
                              <td className="px-4 py-3">{u.username}</td>
                              <td className="px-4 py-3">
                                <Badge variant={u.role === 'admin' ? "default" : "outline"}>
                                  {u.role === 'admin' ? 'Admin' : 'User'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleUnassign(u.id)}
                                >
                                  <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {/* Floor Configuration Section */}
              <Card className="p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <LayoutTemplate className="h-5 w-5 mr-2 text-primary" />
                  Floor Configuration
                </h3>

                <div className="space-y-4">
                  {templateConfig.components.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border rounded-md">
                      <p>No components in this template.</p>
                      <p className="text-xs mt-1">Edit the template to add components</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templateConfig.components.map((component, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: component.color}}>
                            {component.icon === 'laundry' ? (
                              <ShowerHead className="h-5 w-5 text-white" />
                            ) : (
                              <Trash className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">
                              {component.icon && (component.icon.charAt(0).toUpperCase() + component.icon.slice(1))}
                            </div>
                            <div className="text-xs text-gray-500">
                              {component.floors} floor{component.floors !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`floors-${index}`} className="mr-2 text-sm">Floors:</Label>
                            <Input
                              id={`floors-${index}`}
                              type="number"
                              className="w-20"
                              min="1"
                              max="99"
                              value={component.floors}
                              onChange={(e) => updateComponentFloors(index, parseInt(e.target.value) || 1)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}