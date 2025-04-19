import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowUp, ArrowDown, X, CheckCheck } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type RobotTask = {
  id: number;
  serialNumber: string;
  taskType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  details: any;
  createdAt: string;
  createdBy: number;
  startedAt: string | null;
  completedAt: string | null;
  templateId: number;
};

const statusColors = {
  pending: 'bg-yellow-200 text-yellow-800',
  in_progress: 'bg-blue-200 text-blue-800',
  completed: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-200 text-red-800'
};

export default function RobotTasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [tasks, setTasks] = useState<RobotTask[]>([]);
  const [templates, setTemplates] = useState<{id: number, name: string}[]>([]);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  
  // Fetch available templates
  const { data: templatesData } = useQuery({
    queryKey: ['/api/templates'],
  });
  
  useEffect(() => {
    if (templatesData) {
      setTemplates(templatesData.map((t: any) => ({ id: t.id, name: t.name })));
    }
  }, [templatesData]);
  
  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/robot-tasks`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      
      // Subscribe to either all tasks or template-specific tasks
      if (templateFilter !== 'all') {
        socket.send(JSON.stringify({ 
          type: 'subscribe',
          templateId: parseInt(templateFilter)
        }));
      } else {
        socket.send(JSON.stringify({ type: 'subscribe' }));
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        if (data.type === 'task_update') {
          // Update task list based on current filters
          invalidateCurrentQueries();
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      socket.close();
    };
  }, [queryClient, templateFilter]);
  
  // Helper function to invalidate relevant queries based on current filters
  const invalidateCurrentQueries = () => {
    if (templateFilter === 'all') {
      // All tasks or all pending tasks
      queryClient.invalidateQueries({ 
        queryKey: [filter === 'pending' ? '/api/robot-tasks/pending' : '/api/robot-tasks'] 
      });
    } else {
      // Template-specific tasks
      const templateId = parseInt(templateFilter);
      queryClient.invalidateQueries({ 
        queryKey: [
          filter === 'pending' 
            ? `/api/robot-tasks/template/${templateId}/pending` 
            : `/api/robot-tasks/template/${templateId}`
        ] 
      });
    }
  };
  
  // Get tasks based on status and template filters
  const getQueryKey = () => {
    if (templateFilter === 'all') {
      return filter === 'pending' ? '/api/robot-tasks/pending' : '/api/robot-tasks';
    } else {
      const templateId = parseInt(templateFilter);
      return filter === 'pending' 
        ? `/api/robot-tasks/template/${templateId}/pending` 
        : `/api/robot-tasks/template/${templateId}`;
    }
  };
  
  const { data, isLoading, error } = useQuery({
    queryKey: [getQueryKey()],
    refetchInterval: 5000, // Refetch every 5 seconds
  });
  
  useEffect(() => {
    if (data) {
      const allTasks = data as RobotTask[];
      
      // Extract unique task types for the filter
      const uniqueTaskTypes = [...new Set(allTasks.map(task => task.taskType))];
      setTaskTypes(uniqueTaskTypes);
      
      // Apply task type filter if selected
      const filteredTasks = taskTypeFilter === 'all' 
        ? allTasks 
        : allTasks.filter(task => task.taskType === taskTypeFilter);
      
      setTasks(filteredTasks);
    }
  }, [data, taskTypeFilter]);
  
  const cancelTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/robot-tasks/${id}/cancel`, 'PUT'),
    onSuccess: () => {
      invalidateCurrentQueries();
      toast({
        title: "Task cancelled",
        description: "The task has been cancelled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to cancel task. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const completeTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/robot-tasks/${id}/complete`, 'PUT'),
    onSuccess: () => {
      invalidateCurrentQueries();
      toast({
        title: "Task completed",
        description: "The task has been marked as completed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const updatePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number, priority: number }) => 
      apiRequest(`/api/robot-tasks/${id}/priority`, 'PUT', { priority }),
    onSuccess: () => {
      invalidateCurrentQueries();
      toast({
        title: "Priority updated",
        description: "Task priority has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update priority. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const reorderTasksMutation = useMutation({
    mutationFn: (taskIds: number[]) => {
      if (templateFilter === 'all') {
        return apiRequest('/api/robot-tasks/reorder', 'POST', { taskIds });
      } else {
        const templateId = parseInt(templateFilter);
        return apiRequest(`/api/robot-tasks/template/${templateId}/reorder`, 'POST', { taskIds });
      }
    },
    onSuccess: () => {
      invalidateCurrentQueries();
      toast({
        title: "Tasks reordered",
        description: "The task queue has been reordered.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reorder tasks. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  const handleCancelTask = (id: number) => {
    if (window.confirm('Are you sure you want to cancel this task?')) {
      cancelTaskMutation.mutate(id);
    }
  };
  
  const handleCompleteTask = (id: number) => {
    if (window.confirm('Are you sure you want to mark this task as completed?')) {
      completeTaskMutation.mutate(id);
    }
  };
  
  const handlePriorityChange = (id: number, currentPriority: number, change: number) => {
    const newPriority = currentPriority + change;
    if (newPriority < 1) return; // Prevent negative priority
    
    updatePriorityMutation.mutate({ id, priority: newPriority });
  };

  const onDragEnd = (result: {
    destination?: { index: number },
    source: { index: number }
  }) => {
    // Dropped outside the list
    if (!result.destination) {
      return;
    }
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    // Skip if item is dropped in the same position
    if (sourceIndex === destinationIndex) {
      return;
    }
    
    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);
    
    // Update local state
    setTasks(items);
    
    // Send new order to server
    const taskIds = items.map(task => task.id);
    reorderTasksMutation.mutate(taskIds);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading tasks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading tasks. Please try again.
      </div>
    );
  }

  const pendingTasks = tasks?.filter(task => task.status === 'pending') || [];
  const inProgressTasks = tasks?.filter(task => task.status === 'in_progress') || [];
  const completedTasks = tasks?.filter(task => task.status === 'completed') || [];
  const cancelledTasks = tasks?.filter(task => task.status === 'cancelled') || [];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Robot Task Queue</h1>
      
      <div className="flex gap-4 mb-6">
        <div>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Select
            value={templateFilter}
            onValueChange={(value) => setTemplateFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Templates</SelectItem>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select
            value={taskTypeFilter}
            onValueChange={(value) => setTaskTypeFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by task type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Task Types</SelectItem>
              {taskTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="pending-tasks">
                {(provided: any) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Priority</TableHead>
                          <TableHead>Task Type</TableHead>
                          <TableHead>Robot</TableHead>
                          <TableHead>Template</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTasks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">No pending tasks</TableCell>
                          </TableRow>
                        ) : (
                          pendingTasks.map((task, index) => (
                            <Draggable 
                              key={task.id.toString()} 
                              draggableId={task.id.toString()} 
                              index={index}
                            >
                              {(provided: any) => (
                                <TableRow 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center">
                                      <span className="mr-2">{task.priority}</span>
                                      <div className="flex flex-col">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handlePriorityChange(task.id, task.priority, -1)}
                                        >
                                          <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handlePriorityChange(task.id, task.priority, 1)}
                                        >
                                          <ArrowDown className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge className={taskTypeFilter === task.taskType ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>{task.taskType}</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Task Type: {task.taskType}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{task.serialNumber}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {task.templateId ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="outline" className={parseInt(templateFilter) === task.templateId ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}>
                                              {templates.find(t => t.id === task.templateId)?.name || `Template ${task.templateId}`}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Template ID: {task.templateId}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className="text-gray-500">None</span>
                                    )}
                                  </TableCell>
                                  <TableCell>{new Date(task.createdAt).toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="mr-2"
                                      onClick={() => handleCancelTask(task.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleCompleteTask(task.id)}
                                    >
                                      <CheckCheck className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In Progress Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Robot</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">No tasks in progress</TableCell>
                  </TableRow>
                ) : (
                  inProgressTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.priority}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className={taskTypeFilter === task.taskType ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>{task.taskType}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Task Type: {task.taskType}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{task.serialNumber}</Badge>
                      </TableCell>
                      <TableCell>
                        {task.templateId ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={parseInt(templateFilter) === task.templateId ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}>
                                  {templates.find(t => t.id === task.templateId)?.name || `Template ${task.templateId}`}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Template ID: {task.templateId}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </TableCell>
                      <TableCell>{task.startedAt ? new Date(task.startedAt).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="icon"
                          className="mr-2"
                          onClick={() => handleCancelTask(task.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Robot</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No completed tasks</TableCell>
                  </TableRow>
                ) : (
                  completedTasks.slice(0, 5).map((task) => {
                    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : new Date(task.createdAt).getTime();
                    const endTime = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
                    const durationMs = endTime - startTime;
                    const minutes = Math.floor(durationMs / 60000);
                    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
                    const duration = `${minutes}m ${seconds}s`;
                    
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={taskTypeFilter === task.taskType ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>{task.taskType}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Task Type: {task.taskType}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{task.serialNumber}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.templateId ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className={parseInt(templateFilter) === task.templateId ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : ""}>
                                    {templates.find(t => t.id === task.templateId)?.name || `Template ${task.templateId}`}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Template ID: {task.templateId}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </TableCell>
                        <TableCell>{task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell>{duration}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}