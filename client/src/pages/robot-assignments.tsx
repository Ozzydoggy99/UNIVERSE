import React, { useState, useMemo } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { RobotTemplateAssignment, UITemplate } from '@shared/schema';
import { Trash2, Edit, Plus, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// Schema for the form
const assignmentFormSchema = z.object({
  serialNumber: z
    .string()
    .min(1, { message: 'Serial number is required' })
    .max(100, { message: 'Serial number must be at most 100 characters' }),
  templateId: z
    .number({ required_error: 'Template is required' }),
  name: z
    .string()
    .min(1, { message: 'Robot name is required' })
    .max(100, { message: 'Name must be at most 100 characters' })
    .default(''),
  location: z
    .string()
    .max(100, { message: 'Location must be at most 100 characters' })
    .default('Unknown'),
});

type AssignmentFormData = z.infer<typeof assignmentFormSchema>;

export default function RobotAssignments() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<RobotTemplateAssignment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Fetch robot assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['/api/robot-assignments'],
    enabled: !authLoading && !!user && user.role === 'admin',
  });
  
  // Fetch templates for dropdown
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/templates'],
    enabled: !authLoading && !!user && user.role === 'admin',
  });
  
  // Form setup for creating a new robot assignment
  const createForm = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      serialNumber: '',
      name: '',
      location: 'Default Location',
    },
  });
  
  // Form setup for editing an existing robot assignment
  const editForm = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      serialNumber: '',
      templateId: undefined,
      name: '',
      location: '',
    },
  });
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      const res = await fetch('/api/robot-assignments/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create assignment: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: 'Success',
        description: 'Robot template assignment created successfully',
      });
      // Force a refetch of the robot assignments data
      await queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      await queryClient.refetchQueries({ queryKey: ['/api/robot-assignments'] });
      
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create robot template assignment',
        variant: 'destructive',
      });
    },
  });
  
  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: AssignmentFormData & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await fetch(`/api/robot-assignments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Failed to update assignment: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: 'Success',
        description: 'Robot template assignment updated successfully',
      });
      
      // Force a refetch of the robot assignments data
      await queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      await queryClient.refetchQueries({ queryKey: ['/api/robot-assignments'] });
      
      setIsEditDialogOpen(false);
      setCurrentAssignment(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update robot template assignment',
        variant: 'destructive',
      });
    },
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/robot-assignments/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`Failed to delete assignment: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: 'Success',
        description: 'Robot template assignment deleted successfully',
      });
      // Force a refetch of the robot assignments data
      await queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      await queryClient.refetchQueries({ queryKey: ['/api/robot-assignments'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete robot template assignment',
        variant: 'destructive',
      });
    },
  });
  
  // Handle form submissions
  const onCreateSubmit = (data: AssignmentFormData) => {
    createMutation.mutate(data);
  };
  
  const onEditSubmit = (data: AssignmentFormData) => {
    if (!currentAssignment) return;
    
    editMutation.mutate({
      id: currentAssignment.id,
      ...data,
    });
  };
  
  // Setup edit form when an assignment is selected
  const handleEdit = (assignment: RobotTemplateAssignment) => {
    setCurrentAssignment(assignment);
    editForm.reset({
      serialNumber: assignment.serialNumber,
      templateId: assignment.templateId,
      name: assignment.name,
      location: assignment.location,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this robot template assignment?')) {
      deleteMutation.mutate(id);
    }
  };
  
  // Filter assignments based on search term
  const filteredAssignments = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return [];
    }
    
    if (!searchTerm.trim()) {
      return assignments;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return assignments.filter((assignment: RobotTemplateAssignment) => 
      assignment.name.toLowerCase().includes(lowerSearchTerm)
    );
  }, [assignments, searchTerm]);
  
  // Loading state
  if (authLoading || assignmentsLoading || templatesLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Robot Template Assignments</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Robot Template Assignments</CardTitle>
          <CardDescription>
            Manage which templates are assigned to robots by serial number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="relative flex items-center w-72">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search robots by name..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className="absolute right-3" 
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Plus size={16} />
                  Add New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Robot Template Assignment</DialogTitle>
                  <DialogDescription>
                    Assign a template to a robot using its serial number.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serial Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter robot serial number" {...field} />
                          </FormControl>
                          <FormDescription>
                            The unique identifier for the robot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {templates?.map((template: UITemplate) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select which template to assign to this robot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Robot Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter robot name" {...field} />
                          </FormControl>
                          <FormDescription>
                            A friendly name for the robot
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter robot location" {...field} />
                          </FormControl>
                          <FormDescription>
                            Where the robot is primarily located
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Robot Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length > 0 ? (
                filteredAssignments.map((assignment: RobotTemplateAssignment & { templateName?: string }) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.id}</TableCell>
                    <TableCell>{assignment.serialNumber}</TableCell>
                    <TableCell>{assignment.name}</TableCell>
                    <TableCell>
                      {assignment.templateName || 
                       templates?.find(t => t.id === assignment.templateId)?.name || 
                       `Template ID: ${assignment.templateId}`}
                    </TableCell>
                    <TableCell>{assignment.location}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(assignment)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDelete(assignment.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No robot template assignments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Robot Template Assignment</DialogTitle>
            <DialogDescription>
              Update the template assignment for this robot.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter robot serial number" {...field} />
                    </FormControl>
                    <FormDescription>
                      The unique identifier for the robot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates?.map((template: UITemplate) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select which template to assign to this robot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Robot Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter robot name" {...field} />
                    </FormControl>
                    <FormDescription>
                      A friendly name for the robot
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter robot location" {...field} />
                    </FormControl>
                    <FormDescription>
                      Where the robot is primarily located
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Updating...' : 'Update Assignment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}