import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircleIcon, CircleXIcon, ServerIcon, Bot as BotIcon, PencilIcon, Trash2Icon, RefreshCwIcon } from "lucide-react";

// Form schema
const robotAssignmentSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  templateId: z.coerce.number().positive("Template ID is required"),
  robotName: z.string().optional(),
  robotModel: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RobotAssignmentFormValues = z.infer<typeof robotAssignmentSchema>;

// Interface
interface Template {
  id: number;
  name: string;
  description: string;
  layout: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

interface RobotAssignment {
  id: number;
  serialNumber: string;
  templateId: number;
  robotName?: string;
  robotModel?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RobotAssignments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRobot, setSelectedRobot] = useState<RobotAssignment | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch robot assignments
  const { data: robotAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['/api/robot-assignments'],
    queryFn: () => apiRequest('GET', '/api/robot-assignments'),
    refetchOnWindowFocus: false,
    retry: 1,
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to load robot assignments: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Fetch templates for the dropdown
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: () => apiRequest('GET', '/api/templates'),
    refetchOnWindowFocus: false,
    retry: 1,
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to load templates: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Form for creating a new robot assignment
  const createForm = useForm<RobotAssignmentFormValues>({
    resolver: zodResolver(robotAssignmentSchema),
    defaultValues: {
      serialNumber: "",
      templateId: undefined,
      robotName: "",
      robotModel: "",
      isActive: true,
    },
  });

  // Form for editing an existing robot assignment
  const editForm = useForm<RobotAssignmentFormValues>({
    resolver: zodResolver(robotAssignmentSchema),
    defaultValues: {
      serialNumber: "",
      templateId: undefined,
      robotName: "",
      robotModel: "",
      isActive: true,
    },
  });

  // Set the edit form values when a robot is selected
  useEffect(() => {
    if (selectedRobot) {
      editForm.reset({
        serialNumber: selectedRobot.serialNumber,
        templateId: selectedRobot.templateId,
        robotName: selectedRobot.robotName || "",
        robotModel: selectedRobot.robotModel || "",
        isActive: selectedRobot.isActive,
      });
    }
  }, [selectedRobot, editForm]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RobotAssignmentFormValues) => apiRequest('POST', '/api/robot-assignments', data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Robot template assignment created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create robot assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; updates: RobotAssignmentFormValues }) => 
      apiRequest('PUT', `/api/robot-assignments/${data.id}`, data.updates),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Robot template assignment updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      setIsEditDialogOpen(false);
      setSelectedRobot(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update robot assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/robot-assignments/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Robot template assignment deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] });
      setIsDeleteDialogOpen(false);
      setSelectedRobot(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete robot assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submissions
  const onCreateSubmit = (data: RobotAssignmentFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: RobotAssignmentFormValues) => {
    if (selectedRobot) {
      updateMutation.mutate({ id: selectedRobot.id, updates: data });
    }
  };

  const onDeleteConfirm = () => {
    if (selectedRobot) {
      deleteMutation.mutate(selectedRobot.id);
    }
  };

  // Find template name by ID
  const getTemplateName = (templateId: number) => {
    if (!templates || !Array.isArray(templates)) return "Unknown Template";
    const template = templates.find((t: Template) => t.id === templateId);
    return template ? template.name : "Unknown Template";
  };

  // Check if the user is an admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <ServerIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
        <p className="text-muted-foreground mb-4">You need admin privileges to manage robot template assignments.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Robot Template Assignments</h1>
          <p className="text-muted-foreground">Assign templates to robots by serial number</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/robot-assignments'] })}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <BotIcon className="h-4 w-4 mr-2" />
                Add Robot Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Template to Robot</DialogTitle>
                <DialogDescription>
                  Enter the robot's serial number and select a template to assign.
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
                          <Input {...field} placeholder="e.g., AX-2000-123" />
                        </FormControl>
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
                          onValueChange={field.onChange}
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(templates) && templates.map((template: Template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="robotName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Robot Name (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Lobby Assistant" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="robotModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Robot Model (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., AxBot 2000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Only active robot assignments will be processed
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Assignment"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoadingAssignments || isLoadingTemplates ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="bg-muted/30 h-[100px]"></CardHeader>
              <CardContent className="pt-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !robotAssignments || !Array.isArray(robotAssignments) || robotAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <BotIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Robot Assignments Yet</h2>
          <p className="text-muted-foreground mb-4">Create your first robot template assignment to get started.</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <BotIcon className="h-4 w-4 mr-2" />
            Add Robot Assignment
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {robotAssignments.map((assignment: RobotAssignment) => (
            <Card key={assignment.id} className={!assignment.isActive ? "opacity-70" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">
                    {assignment.robotName || `Robot ${assignment.serialNumber}`}
                  </CardTitle>
                  <Badge variant={assignment.isActive ? "default" : "outline"}>
                    {assignment.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>Serial: {assignment.serialNumber}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Template:</span>
                    <span>{getTemplateName(assignment.templateId)}</span>
                  </div>
                  {assignment.robotModel && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Model:</span>
                      <span>{assignment.robotModel}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Created:</span>
                    <span>{new Date(assignment.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSelectedRobot(assignment);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setSelectedRobot(assignment);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2Icon className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Robot Assignment</DialogTitle>
            <DialogDescription>
              Update the robot template assignment details.
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
                      <Input {...field} />
                    </FormControl>
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
                      onValueChange={field.onChange}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(templates) && templates.map((template: Template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="robotName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Robot Name (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="robotModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Robot Model (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Only active robot assignments will be processed
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the assignment for {selectedRobot?.robotName || `Robot ${selectedRobot?.serialNumber}`}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={onDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}