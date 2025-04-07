import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Edit, Trash2, Users, ShowerHead, PlusCircle, Trash, Clipboard } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { UITemplate, User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function TemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<UITemplate | null>(null);
  // Template form data and visual editor state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    layout: '',
    isActive: true,
  });
  
  // Visual template builder - components state
  const [templateConfig, setTemplateConfig] = useState({
    primaryColor: '#228B22',  // Default green
    secondaryColor: '#000000', // Default black
    components: [] as any[],
  });
  
  // Helper to sync visual editor with JSON layout
  const syncTemplateWithJson = (layout: string) => {
    try {
      const parsed = JSON.parse(layout);
      setTemplateConfig(parsed);
    } catch (e) {
      console.error("Failed to parse template layout:", e);
    }
  };
  
  // Helper to update JSON from visual editor
  const updateJsonFromTemplate = () => {
    const jsonString = JSON.stringify(templateConfig, null, 2);
    setFormData({...formData, layout: jsonString});
  };
  
  // Fetch all templates
  const { data: templates, isLoading: templatesLoading } = useQuery<UITemplate[]>({
    queryKey: ['/api/templates'],
  });
  
  // Fetch all users for template assignment
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: isAssignDialogOpen,
  });

  // Create a new template
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/api/templates', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template created',
        description: 'The template has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Update an existing template
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<UITemplate> }) => {
      const res = await apiRequest('PUT', `/api/templates/${data.id}`, data.updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template updated',
        description: 'The template has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Delete a template
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/templates/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Template deleted',
        description: 'The template has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
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
      setIsAssignDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error assigning template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const handleCreateTemplate = () => {
    createMutation.mutate(formData);
  };
  
  const handleUpdateTemplate = () => {
    if (!currentTemplate) return;
    updateMutation.mutate({
      id: currentTemplate.id,
      updates: formData,
    });
  };
  
  const handleDeleteTemplate = (template: UITemplate) => {
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      deleteMutation.mutate(template.id);
    }
  };
  
  const handleAssignTemplate = (userId: number, templateId: number) => {
    assignMutation.mutate({ userId, templateId });
  };
  
  const openEditDialog = (template: UITemplate) => {
    setCurrentTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      layout: template.layout,
      isActive: template.isActive,
    });
    // Sync the visual editor with the template layout
    syncTemplateWithJson(template.layout);
    setIsEditDialogOpen(true);
  };
  
  // Effect to sync JSON when templateConfig changes
  useEffect(() => {
    if (isCreateDialogOpen || isEditDialogOpen) {
      updateJsonFromTemplate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateConfig, isCreateDialogOpen, isEditDialogOpen]);
  
  const openAssignDialog = (template: UITemplate) => {
    setCurrentTemplate(template);
    setIsAssignDialogOpen(true);
  };
  
  // Function to add a new component to the template
  const addComponent = (type: string, icon: string) => {
    const newComponent = {
      type: 'rectangle',
      icon,
      label: icon.toUpperCase(),
      color: icon === 'laundry' ? '#228B22' : '#0047AB', // Green for laundry, Blue for trash 
      floors: 1, // Default floor count
    };
    
    setTemplateConfig({
      ...templateConfig,
      components: [...templateConfig.components, newComponent],
    });
  };
  
  // Function to update component's floors count
  const updateComponentFloors = (index: number, floors: number) => {
    const updatedComponents = [...templateConfig.components];
    updatedComponents[index] = { 
      ...updatedComponents[index], 
      floors: Math.max(1, Math.min(99, floors)) 
    };
    
    setTemplateConfig({
      ...templateConfig,
      components: updatedComponents,
    });
  };
  
  // Function to remove a component
  const removeComponent = (index: number) => {
    const updatedComponents = templateConfig.components.filter((_, i) => i !== index);
    setTemplateConfig({
      ...templateConfig,
      components: updatedComponents,
    });
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      layout: '',
      isActive: true,
    });
    setTemplateConfig({
      primaryColor: '#228B22',
      secondaryColor: '#000000',
      components: [],
    });
    setCurrentTemplate(null);
  };
  
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="template-manager space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">UI Templates</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <Link key={template.id} href={`/templates/${template.id}`} className="block group">
            <Card className="p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold group-hover:text-primary">{template.name}</h3>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </div>
              </div>
              
              <div className="flex items-center mt-3">
                <div className="text-xs text-gray-500">
                  <div className="flex items-center">
                    <span className={`h-2 w-2 rounded-full ${template.isActive ? 'bg-green-500' : 'bg-gray-400'} mr-1`}></span>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </div>
                  <div className="mt-1">Created: {new Date(template.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        
        {templates?.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-32 bg-gray-50 rounded-md">
            <p className="text-gray-500">No templates available. Create one to get started.</p>
          </div>
        )}
      </div>
      
      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className="space-y-4">
                <Tabs defaultValue="editor">
                  <TabsList>
                    <TabsTrigger value="editor">Visual Editor</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="editor" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template Color</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="color" 
                          className="w-16 h-10" 
                          value={templateConfig.primaryColor} 
                          onChange={(e) => setTemplateConfig({...templateConfig, primaryColor: e.target.value})}
                        />
                        <Input 
                          className="w-32"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({...templateConfig, primaryColor: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 py-2">
                      <div className="flex items-center justify-between">
                        <Label>Components</Label>
                        <div className="space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => addComponent('rectangle', 'laundry')}
                          >
                            <ShowerHead className="h-4 w-4 mr-1" />
                            Add Laundry
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => addComponent('rectangle', 'trash')}
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Add Trash
                          </Button>
                        </div>
                      </div>
                      
                      <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto">
                        {templateConfig.components.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No components added yet.</p>
                            <p className="text-xs mt-1">Add laundry or trash components using the buttons above</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {templateConfig.components.map((component, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: component.color}}>
                                  {component.icon === 'laundry' ? (
                                    <ShowerHead className="h-5 w-5 text-white" />
                                  ) : (
                                    <Trash className="h-5 w-5 text-white" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {component.icon && component.icon.charAt(0).toUpperCase() + component.icon.slice(1)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {component.floors} floor{component.floors !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center w-28">
                                    <Label htmlFor={`floors-${index}`} className="w-14 text-xs">Floors:</Label>
                                    <Input
                                      id={`floors-${index}`}
                                      type="number"
                                      min="1"
                                      max="99"
                                      className="h-8"
                                      value={component.floors}
                                      onChange={(e) => updateComponentFloors(index, parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => removeComponent(index)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="json">
                    <div className="space-y-2">
                      <Label htmlFor="layout">Layout (JSON)</Label>
                      <Textarea
                        id="layout"
                        className="h-56 font-mono text-sm"
                        value={formData.layout}
                        onChange={(e) => {
                          setFormData({ ...formData, layout: e.target.value });
                          try {
                            syncTemplateWithJson(e.target.value);
                          } catch (err) {
                            // Silent error - don't update visual editor if JSON is invalid
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs" 
                          onClick={() => {
                            try {
                              // Copy to clipboard
                              navigator.clipboard.writeText(formData.layout);
                              toast({
                                title: "Copied to clipboard",
                                duration: 2000,
                              });
                            } catch (err) {
                              console.error("Failed to copy:", err);
                            }
                          }}
                        >
                          <Clipboard className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="is-active">Active</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setIsCreateDialogOpen(false);
            }}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={!formData.name || !formData.layout}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Template Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className="space-y-4">
                <Tabs defaultValue="editor">
                  <TabsList>
                    <TabsTrigger value="editor">Visual Editor</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="editor" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template Color</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="color" 
                          className="w-16 h-10" 
                          value={templateConfig.primaryColor} 
                          onChange={(e) => setTemplateConfig({...templateConfig, primaryColor: e.target.value})}
                        />
                        <Input 
                          className="w-32"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({...templateConfig, primaryColor: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 py-2">
                      <div className="flex items-center justify-between">
                        <Label>Components</Label>
                        <div className="space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => addComponent('rectangle', 'laundry')}
                          >
                            <ShowerHead className="h-4 w-4 mr-1" />
                            Add Laundry
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => addComponent('rectangle', 'trash')}
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Add Trash
                          </Button>
                        </div>
                      </div>
                      
                      <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto">
                        {templateConfig.components.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No components added yet.</p>
                            <p className="text-xs mt-1">Add laundry or trash components using the buttons above</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {templateConfig.components.map((component, index) => (
                              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: component.color}}>
                                  {component.icon === 'laundry' ? (
                                    <ShowerHead className="h-5 w-5 text-white" />
                                  ) : (
                                    <Trash className="h-5 w-5 text-white" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {component.icon && component.icon.charAt(0).toUpperCase() + component.icon.slice(1)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {component.floors} floor{component.floors !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center w-28">
                                    <Label htmlFor={`edit-floors-${index}`} className="w-14 text-xs">Floors:</Label>
                                    <Input
                                      id={`edit-floors-${index}`}
                                      type="number"
                                      min="1"
                                      max="99"
                                      className="h-8"
                                      value={component.floors}
                                      onChange={(e) => updateComponentFloors(index, parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => removeComponent(index)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="json">
                    <div className="space-y-2">
                      <Label htmlFor="edit-layout">Layout (JSON)</Label>
                      <Textarea
                        id="edit-layout"
                        className="h-56 font-mono text-sm"
                        value={formData.layout}
                        onChange={(e) => {
                          setFormData({ ...formData, layout: e.target.value });
                          try {
                            syncTemplateWithJson(e.target.value);
                          } catch (err) {
                            // Silent error - don't update visual editor if JSON is invalid
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs" 
                          onClick={() => {
                            try {
                              // Copy to clipboard
                              navigator.clipboard.writeText(formData.layout);
                              toast({
                                title: "Copied to clipboard",
                                duration: 2000,
                              });
                            } catch (err) {
                              console.error("Failed to copy:", err);
                            }
                          }}
                        >
                          <Clipboard className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-is-active">Active</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setIsEditDialogOpen(false);
            }}>Cancel</Button>
            <Button onClick={handleUpdateTemplate} disabled={!formData.name || !formData.layout}>
              Update Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Template Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Template to Users</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            <h3 className="text-md font-medium mb-2">Template: {currentTemplate?.name}</h3>
            
            <div className="border rounded-md divide-y overflow-hidden max-h-[300px] overflow-y-auto">
              {users?.map((user) => (
                <div key={user.id} className="p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-gray-500">{user.role}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs">
                      {user.templateId === currentTemplate?.id
                        ? "This template assigned"
                        : user.templateId
                        ? "Different template assigned"
                        : "No template"}
                    </div>
                    <Button
                      size="sm"
                      variant={user.templateId === currentTemplate?.id ? "outline" : "default"}
                      disabled={assignMutation.isPending}
                      onClick={() => handleAssignTemplate(user.id, currentTemplate?.id || 0)}
                    >
                      {user.templateId === currentTemplate?.id ? "Remove" : "Assign"}
                    </Button>
                  </div>
                </div>
              ))}
              
              {!users?.length && (
                <div className="p-4 text-center text-gray-500">
                  No users available.
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}