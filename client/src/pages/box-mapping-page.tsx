import React from 'react';
import { BoxMappingManager } from '@/components/admin/box-mapping-manager';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function BoxMappingPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  const [, navigate] = useLocation();
  
  // If user is not authenticated or not an admin, redirect to home
  if (!user || user.role !== 'admin') {
    toast({
      title: 'Access denied',
      description: 'You need administrator privileges to access this page.',
      variant: 'destructive',
    });
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Box Mapping Configuration</h1>
      
      <div className="mb-8">
        <p className="text-slate-600 dark:text-slate-300 mb-4">
          This page allows you to configure mappings between box numbers and coordinates on the floor map.
          When users select a specific box in the laundry or trash service, the robot can navigate to the 
          corresponding location on the map.
        </p>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400">Important Note</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            Make sure to configure the correct coordinates for each box to ensure the robot navigates to the right location.
            The coordinates should match the AxBot's floor map coordinate system.
          </p>
        </div>
      </div>
      
      <BoxMappingManager />
    </div>
  );
}