import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Award, TrendingUp, Clock, Route, Navigation } from "lucide-react";

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
  location?: string;
  parameters?: string;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
};

export default function OptimizationStats() {
  const [optimizedTasksCount, setOptimizedTasksCount] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [averageDistance, setAverageDistance] = useState(0);
  const [optimizationPercentage, setOptimizationPercentage] = useState(0);
  const [timePerTask, setTimePerTask] = useState(0);
  const [totalTimesSaved, setTotalTimesSaved] = useState(0);
  
  // Fetch all tasks to calculate performance metrics
  const { data: tasksData } = useQuery({
    queryKey: ['/api/robot-tasks'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  useEffect(() => {
    if (tasksData) {
      const tasks = tasksData as RobotTask[];
      
      // Calculate number of optimized tasks
      const optimizedTasks = tasks.filter(task => {
        try {
          if (task.parameters) {
            const params = JSON.parse(task.parameters);
            return params.wasOptimizedAssignment === true;
          }
          return false;
        } catch (e) {
          return false;
        }
      });
      
      setOptimizedTasksCount(optimizedTasks.length);
      setTotalTasksCount(tasks.length);
      
      if (optimizedTasks.length > 0) {
        // Calculate average distance for optimized tasks
        let totalDistance = 0;
        let validDistanceCount = 0;
        
        optimizedTasks.forEach(task => {
          try {
            if (task.parameters) {
              const params = JSON.parse(task.parameters);
              if (params.distanceFromPrevious) {
                totalDistance += parseFloat(params.distanceFromPrevious);
                validDistanceCount++;
              }
            }
          } catch (e) {
            // Skip this task if we can't parse parameters
          }
        });
        
        if (validDistanceCount > 0) {
          setAverageDistance(parseFloat((totalDistance / validDistanceCount).toFixed(2)));
        }
        
        // Calculate completed task times to estimate time savings
        const completedTasks = tasks.filter(task => task.status === 'completed' && task.startedAt && task.completedAt);
        
        if (completedTasks.length > 0) {
          // Calculate average task completion time
          let totalDuration = 0;
          
          completedTasks.forEach(task => {
            const startTime = new Date(task.startedAt || task.createdAt).getTime();
            const endTime = new Date(task.completedAt || Date.now()).getTime();
            totalDuration += (endTime - startTime);
          });
          
          const avgTimePerTask = totalDuration / completedTasks.length / 1000; // in seconds
          setTimePerTask(parseFloat(avgTimePerTask.toFixed(2)));
          
          // Estimate time saved (assuming 50% time saved per optimized task)
          // This is a rough estimate based on not having to return to base between tasks
          const estimatedTimeSaved = (optimizedTasks.length * avgTimePerTask * 0.5) / 60; // in minutes
          setTotalTimesSaved(parseFloat(estimatedTimeSaved.toFixed(2)));
        }
      }
      
      // Calculate optimization percentage
      if (tasks.length > 0) {
        const percentage = (optimizedTasks.length / tasks.filter(task => task.taskType === 'PICKUP').length) * 100;
        setOptimizationPercentage(parseFloat(percentage.toFixed(1)) || 0);
      }
    }
  }, [tasksData]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Route className="h-5 w-5 mr-2" />
          <span>Route Optimization Statistics</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
              <span>Optimization Rate:</span>
            </div>
            <div className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      {optimizationPercentage}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{optimizedTasksCount} out of {totalTasksCount} tasks were optimized</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <Progress value={optimizationPercentage} className="h-2" />
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Navigation className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-sm">Average Distance</span>
              </div>
              <div className="text-xl font-semibold">{averageDistance} units</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-amber-500" />
                <span className="text-sm">Time Saved (est.)</span>
              </div>
              <div className="text-xl font-semibold">{totalTimesSaved} min</div>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Award className="h-4 w-4 mr-2 text-purple-500" />
              <span className="text-sm">Optimized Tasks</span>
            </div>
            <Badge variant="outline" className="bg-purple-100 text-purple-800">
              {optimizedTasksCount}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}