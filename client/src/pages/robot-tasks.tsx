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
  const [tasks, setTasks] = useState<RobotTask[]>([]);
  
  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/robot-tasks`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({ type: 'subscribe' }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        if (data.type === 'task_update') {
          // Update task list
          queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks/pending'] });
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
  }, [queryClient]);
  
  const { data, isLoading, error } = useQuery({
    queryKey: [filter === 'pending' ? '/api/robot-tasks/pending' : '/api/robot-tasks'],
    refetchInterval: 5000, // Refetch every 5 seconds
  });
  
  useEffect(() => {
    if (data) {
      setTasks(data);
    }
  }, [data]);
  
  const cancelTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/robot-tasks/${id}/cancel`, 'PUT'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks/pending'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks/pending'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks/pending'] });
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
    mutationFn: (taskIds: number[]) => 
      apiRequest('/api/robot-tasks/reorder', 'POST', { taskIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/robot-tasks/pending'] });
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

  const onDragEnd = (result: any) => {
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
      
      <div className="mb-6">
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

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="pending-tasks">
                {(provided) => (
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
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTasks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">No pending tasks</TableCell>
                          </TableRow>
                        ) : (
                          pendingTasks.map((task, index) => (
                            <Draggable 
                              key={task.id.toString()} 
                              draggableId={task.id.toString()} 
                              index={index}
                            >
                              {(provided) => (
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
                                  <TableCell>{task.taskType}</TableCell>
                                  <TableCell>{task.serialNumber}</TableCell>
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
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">No tasks in progress</TableCell>
                  </TableRow>
                ) : (
                  inProgressTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.priority}</TableCell>
                      <TableCell>{task.taskType}</TableCell>
                      <TableCell>{task.serialNumber}</TableCell>
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
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">No completed tasks</TableCell>
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
                        <TableCell>{task.taskType}</TableCell>
                        <TableCell>{task.serialNumber}</TableCell>
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