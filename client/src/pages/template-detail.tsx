import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocation, Link } from 'wouter';
import { Loader2, LayoutTemplate, ArrowLeft, Users, Trash, ShowerHead, UserPlus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [unsavedFloors, setUnsavedFloors] = useState<Record<number, string | number>>({});
  const [globalFloors, setGlobalFloors] = useState<number>(1);
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

  // Create new user
  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await apiRequest('POST', '/api/register', data);
      return await res.json();
    },
    onSuccess: (newUser) => {
      toast({
        title: 'User created',
        description: 'The new user has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Auto-assign the template to the new user
      if (templateId) {
        assignMutation.mutate({
          userId: newUser.id,
          templateId: templateId
        });
      }
      
      setNewUsername("");
      setNewPassword("");
      setIsCreateUserDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating user',
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
      // Clear unsaved floors after successful update
      setUnsavedFloors({});
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

  // Function to store temporary floor changes
  const storeFloorChange = (index: number, value: string) => {
    if (!template) return;
    
    if (value === '') {
      // Allow empty value for typing purposes
      setUnsavedFloors({
        ...unsavedFloors,
        [index]: ''
      });
    } else {
      // Convert to number and validate when it's a number
      const floors = parseInt(value);
      if (!isNaN(floors)) {
        setUnsavedFloors({
          ...unsavedFloors,
          [index]: Math.max(1, Math.min(99, floors))
        });
      }
    }
  };
  
  // Function to apply global floor setting to all components
  const applyGlobalFloors = () => {
    if (!template || templateConfig.components.length === 0) return;
    
    const updatedConfig = { ...templateConfig };
    updatedConfig.components = updatedConfig.components.map(comp => ({
      ...comp,
      floors: globalFloors
    }));
    
    // Update the template with the new layout
    updateTemplateMutation.mutate({
      id: template.id,
      updates: {
        layout: JSON.stringify(updatedConfig)
      }
    });
  };
  
  // Function to save all unsaved floor changes
  const saveFloorChanges = () => {
    if (!template || Object.keys(unsavedFloors).length === 0) return;
    
    const updatedConfig = { ...templateConfig };
    
    // Apply all unsaved changes
    Object.entries(unsavedFloors).forEach(([indexStr, floorValue]) => {
      const index = parseInt(indexStr);
      if (updatedConfig.components[index]) {
        // Convert any string value to number for storage
        let numericValue = 1;
        if (typeof floorValue === 'string') {
          numericValue = floorValue === '' ? 1 : parseInt(floorValue) || 1;
        } else {
          numericValue = floorValue as number;
        }
        
        updatedConfig.components[index].floors = Math.max(1, Math.min(99, numericValue));
      }
    });
    
    // Update the template with the new layout
    updateTemplateMutation.mutate({
      id: template.id,
      updates: {
        layout: JSON.stringify(updatedConfig)
      }
    });
  };
  
  // Function to create a new user
  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      toast({
        title: 'Missing information',
        description: 'Please provide both username and password.',
        variant: 'destructive'
      });
      return;
    }
    
    createUserMutation.mutate({
      username: newUsername,
      password: newPassword,
      role: 'user'
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
      {/* Create User Dialog */}
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User for Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input 
                id="new-username" 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter a username" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input 
                id="new-password" 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a password" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={!newUsername || !newPassword}>
              Create & Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => setIsCreateUserDialogOpen(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create New User for Template
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

                {templateConfig.components.length > 0 && (
                  <div className="flex items-end gap-2 mb-4 p-3 bg-slate-50 rounded-md border">
                    <div className="flex-1">
                      <Label htmlFor="global-floors" className="mb-2 block text-sm font-medium">Set Floor Count for All Components</Label>
                      <Input
                        id="global-floors"
                        type="number"
                        className="w-full"
                        min="1"
                        max="99"
                        value={globalFloors}
                        onChange={(e) => setGlobalFloors(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <Button onClick={applyGlobalFloors}>
                      Apply to All
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {templateConfig.components.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border rounded-md">
                      <p>No components in this template.</p>
                      <p className="text-xs mt-1">Edit the template to add components</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templateConfig.components.map((component, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border relative">
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
                              {unsavedFloors[index] !== undefined ? unsavedFloors[index] : component.floors} floor{(unsavedFloors[index] !== undefined ? unsavedFloors[index] : component.floors) !== 1 ? 's' : ''}
                              {unsavedFloors[index] !== undefined && <span className="text-amber-500"> (unsaved)</span>}
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
                              value={unsavedFloors[index] !== undefined ? unsavedFloors[index] : component.floors}
                              onChange={(e) => storeFloorChange(index, e.target.value)}
                            />
                          </div>
                          {unsavedFloors[index] !== undefined && (
                            <Button 
                              size="sm" 
                              className="absolute bottom-1 right-1" 
                              variant="ghost"
                              onClick={() => {
                                const newUnsavedFloors = { ...unsavedFloors };
                                delete newUnsavedFloors[index];
                                setUnsavedFloors(newUnsavedFloors);
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      {Object.keys(unsavedFloors).length > 0 && (
                        <div className="flex justify-end mt-4">
                          <Button 
                            onClick={saveFloorChanges}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save All Floor Changes
                          </Button>
                        </div>
                      )}
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