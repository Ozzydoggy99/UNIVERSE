import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { MapPin, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { BoxMapPoint } from '@shared/schema';

// Using BoxMapPoint type from shared schema

export function BoxMappingManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'laundry' | 'trash'>('laundry');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentBoxMapping, setCurrentBoxMapping] = useState<BoxMapPoint | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);

  // Fetch box mappings from API - now we only use this to show errors
  const { isLoading: isLoadingAllBoxes, error: errorLoadingBoxes } = useQuery<BoxMapPoint[]>({
    queryKey: ['/api/box-mappings'],
    // We will use specific filtered queries instead of this general one
    enabled: false 
  });

  // Create a mutation to save/update box mapping
  const saveBoxMappingMutation = useMutation({
    mutationFn: async (mapping: BoxMapPoint) => {
      if (mapping.id) {
        // Update existing mapping
        return await apiRequest('PUT', `/api/box-mappings/${mapping.id}`, mapping);
      } else {
        // Create new mapping
        return await apiRequest('POST', '/api/box-mappings', mapping);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Box mapping saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/box-mappings'] });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to save box mapping: ${error.message}`,
      });
    }
  });

  // Delete mutation
  const deleteBoxMappingMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/box-mappings/${id}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Box mapping deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/box-mappings'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to delete box mapping: ${error.message}`,
      });
    }
  });

  // Handle editing a box mapping
  const handleEditBoxMapping = (mapping: BoxMapPoint) => {
    setCurrentBoxMapping(mapping);
    setIsEditDialogOpen(true);
  };

  // Handle creating a new box mapping
  const handleAddBoxMapping = () => {
    setCurrentBoxMapping({
      id: 0, // Will be assigned by server
      serviceType: activeTab,
      floor: selectedFloor,
      unitNumber: selectedFloor * 100 + 1,
      xCoordinate: 0,
      yCoordinate: 0
    });
    setIsEditDialogOpen(true);
  };

  // Handle saving a box mapping
  const handleSaveBoxMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentBoxMapping) {
      saveBoxMappingMutation.mutate(currentBoxMapping);
    }
  };

  // Handle deleting a box mapping
  const handleDeleteBoxMapping = (id: number) => {
    if (confirm('Are you sure you want to delete this box mapping?')) {
      deleteBoxMappingMutation.mutate(id);
    }
  };

  // Get box mappings filtered by service type and floor
  const { data: filteredMappings = [] } = useQuery<BoxMapPoint[]>({
    queryKey: ['/api/box-mappings/service', activeTab, 'floor', selectedFloor],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/box-mappings/service/${activeTab}/floor/${selectedFloor}`);
      return res.json();
    }
  });

  // Query for available floors
  const { data: availableFloors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } = useQuery<number[]>({
    queryKey: ['/api/box-mappings/floors', activeTab],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/box-mappings/floors/${activeTab}`);
      return res.json();
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Box to Map Point Mappings</h2>
        <Button onClick={handleAddBoxMapping}>
          <Plus className="h-4 w-4 mr-2" />
          Add Mapping
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'laundry' | 'trash')}>
        <TabsList className="mb-4">
          <TabsTrigger value="laundry">Laundry Boxes</TabsTrigger>
          <TabsTrigger value="trash">Trash Boxes</TabsTrigger>
        </TabsList>
        
        <div className="mb-4">
          <Label>Floor:</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {availableFloors.map(floor => (
              <Button
                key={floor}
                variant={selectedFloor === floor ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFloor(floor)}
              >
                {floor}
              </Button>
            ))}
          </div>
        </div>
        
        <Card className="p-4">
          {saveBoxMappingMutation.isPending || deleteBoxMappingMutation.isPending ? (
            <div className="text-center py-4">Processing...</div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No mappings found for this service and floor. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>X Coordinate</TableHead>
                  <TableHead>Y Coordinate</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map(mapping => (
                  <TableRow key={mapping.id}>
                    <TableCell>{mapping.unitNumber}</TableCell>
                    <TableCell>{mapping.xCoordinate}</TableCell>
                    <TableCell>{mapping.yCoordinate}</TableCell>
                    <TableCell>{mapping.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditBoxMapping(mapping)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBoxMapping(mapping.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Tabs>

      {/* Edit/Add Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentBoxMapping?.id ? 'Edit' : 'Add'} Box Mapping</DialogTitle>
            <DialogDescription>
              Map a unit number to coordinates on the floor map.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveBoxMapping}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="service-type" className="text-right">
                  Service Type
                </Label>
                <div className="col-span-3">
                  <select
                    id="service-type"
                    className="w-full p-2 border rounded-md"
                    value={currentBoxMapping?.serviceType || 'laundry'}
                    onChange={(e) => setCurrentBoxMapping((current: BoxMapPoint | null) => 
                      current ? {...current, serviceType: e.target.value as 'laundry' | 'trash'} : null
                    )}
                  >
                    <option value="laundry">Laundry</option>
                    <option value="trash">Trash</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="floor" className="text-right">
                  Floor
                </Label>
                <Input
                  id="floor"
                  type="number"
                  min="1"
                  max="99"
                  className="col-span-3"
                  value={currentBoxMapping?.floor || 1}
                  onChange={(e) => {
                    const floor = parseInt(e.target.value);
                    if (floor >= 1 && floor <= 99) {
                      setCurrentBoxMapping((current: BoxMapPoint | null) => 
                        current ? {
                          ...current, 
                          floor,
                          // Update unit number when floor changes
                          unitNumber: floor * 100 + (current.unitNumber % 100)
                        } : null
                      );
                    }
                  }}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit-number" className="text-right">
                  Unit Number
                </Label>
                <Input
                  id="unit-number"
                  type="number"
                  className="col-span-3"
                  value={currentBoxMapping?.unitNumber || 0}
                  onChange={(e) => setCurrentBoxMapping((current: BoxMapPoint | null) => 
                    current ? {...current, unitNumber: parseInt(e.target.value)} : null
                  )}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="x-coordinate" className="text-right">
                  X Coordinate
                </Label>
                <Input
                  id="x-coordinate"
                  type="number"
                  className="col-span-3"
                  value={currentBoxMapping?.xCoordinate || 0}
                  onChange={(e) => setCurrentBoxMapping((current: BoxMapPoint | null) => 
                    current ? {...current, xCoordinate: parseInt(e.target.value)} : null
                  )}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="y-coordinate" className="text-right">
                  Y Coordinate
                </Label>
                <Input
                  id="y-coordinate"
                  type="number"
                  className="col-span-3"
                  value={currentBoxMapping?.yCoordinate || 0}
                  onChange={(e) => setCurrentBoxMapping((current: BoxMapPoint | null) => 
                    current ? {...current, yCoordinate: parseInt(e.target.value)} : null
                  )}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  className="col-span-3"
                  value={currentBoxMapping?.description || ''}
                  onChange={(e) => setCurrentBoxMapping((current: BoxMapPoint | null) => 
                    current ? {...current, description: e.target.value} : null
                  )}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {saveBoxMappingMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}