import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Edit, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    layout: '',
    isActive: true,
  });
  
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
    setIsEditDialogOpen(true);
  };
  
  const openAssignDialog = (template: UITemplate) => {
    setCurrentTemplate(template);
    setIsAssignDialogOpen(true);
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      layout: '',
      isActive: true,
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
          <Card key={template.id} className="p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-sm text-gray-500">{template.description}</p>
              </div>
              <div className="space-x-1">
                <Button variant="outline" size="sm" onClick={() => openAssignDialog(template)}>
                  <Users className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="mt-1 text-xs text-gray-500">
              <div className="flex items-center">
                <span className={`h-2 w-2 rounded-full ${template.isActive ? 'bg-green-500' : 'bg-gray-400'} mr-1`}></span>
                {template.isActive ? 'Active' : 'Inactive'}
              </div>
              <div className="mt-1">Created: {new Date(template.createdAt).toLocaleDateString()}</div>
            </div>
          </Card>
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
              
              <div className="space-y-2">
                <Label htmlFor="layout">Layout (JSON)</Label>
                <Textarea
                  id="layout"
                  className="h-36 font-mono text-sm"
                  value={formData.layout}
                  onChange={(e) => setFormData({ ...formData, layout: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  Enter the layout configuration in JSON format. This defines how the template will be rendered.
                </p>
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
              
              <div className="space-y-2">
                <Label htmlFor="edit-layout">Layout (JSON)</Label>
                <Textarea
                  id="edit-layout"
                  className="h-36 font-mono text-sm"
                  value={formData.layout}
                  onChange={(e) => setFormData({ ...formData, layout: e.target.value })}
                />
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