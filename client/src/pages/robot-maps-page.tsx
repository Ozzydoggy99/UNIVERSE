import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapDigitalTwin } from "@/components/robot-map/MapDigitalTwin";
import { Loader2, Map as MapIcon, Copy, Check, Search, RefreshCw } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Fixed physical robot serial - in a full implementation, this would come from the available robots list
const PHYSICAL_ROBOT_SERIAL = "L382502104987ir";

interface RobotMap {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  robotSerial: string;
  size: [number, number];
  resolution: number;
}

const RobotMapsPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<string>("maps");
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Fetch robots (would get more robots in a full implementation)
  const { data: robots, isLoading: robotsLoading } = useQuery({
    queryKey: ["/api/robots"],
    select: (data: any) => data || []
  });
  
  // Fetch maps
  const { data: maps, isLoading: mapsLoading, refetch: refetchMaps } = useQuery({
    queryKey: ["/api/robots/maps"],
    select: (data: any) => data || []
  });
  
  // Filter maps by search query
  const filteredMaps = React.useMemo(() => {
    if (!maps || !Array.isArray(maps)) return [];
    
    return maps.filter((map: RobotMap) => 
      map.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      map.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      map.robotSerial?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [maps, searchQuery]);
  
  // When maps load, select the first one by default
  useEffect(() => {
    if (maps && maps.length > 0 && !selectedMap) {
      setSelectedMap(maps[0].id);
    }
  }, [maps, selectedMap]);
  
  // Handle map selection
  const handleSelectMap = (mapId: string) => {
    setSelectedMap(mapId);
  };
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Robot Maps</h1>
          <p className="text-muted-foreground">
            View, manage, and assign robot maps
          </p>
        </div>
        <Button onClick={() => refetchMaps()} className="ml-auto">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh Maps
        </Button>
      </div>
      
      <Tabs defaultValue="maps" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="assignments">Map Assignments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="maps" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Map List Panel */}
            <Card className="w-full md:w-1/3">
              <CardHeader>
                <CardTitle>Available Maps</CardTitle>
                <CardDescription>
                  Select a map to view details
                </CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    type="text"
                    placeholder="Search maps..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {mapsLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredMaps.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">
                    No maps found
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {filteredMaps.map((map: RobotMap) => (
                      <div
                        key={map.id}
                        className={`p-3 rounded-md cursor-pointer transition-colors ${
                          selectedMap === map.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => handleSelectMap(map.id)}
                      >
                        <div className="flex items-center">
                          <MapIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                          <div className="overflow-hidden">
                            <div className="font-medium truncate">{map.name}</div>
                            <div className="text-xs truncate">
                              {map.robotSerial}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <div className="text-xs text-muted-foreground">
                  {filteredMaps.length} map(s) available
                </div>
              </CardFooter>
            </Card>

            {/* Map Viewer Panel */}
            <Card className="w-full md:w-2/3">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Map Viewer</CardTitle>
                    <CardDescription>
                      Digital twin representation of the robot map
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        if (!selectedMap) {
                          toast({
                            title: "No map selected",
                            description: "Please select a map first",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Call the copy map API
                        const map = maps?.find((m: RobotMap) => m.id === selectedMap);
                        if (!map) return;
                        
                        // In a real multi-robot system, we would show a dialog to select 
                        // the target robot. For now, we're copying to the same robot with a new name.
                        const newMapName = `Copy of ${map.name}`;
                        
                        fetch('/api/robots/copy-map', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({
                            mapId: selectedMap,
                            sourceRobotSerial: PHYSICAL_ROBOT_SERIAL,
                            targetRobotSerial: PHYSICAL_ROBOT_SERIAL,
                            newMapName
                          })
                        })
                        .then(res => res.json())
                        .then(data => {
                          if (data.success) {
                            toast({
                              title: "Map copied",
                              description: `Map "${map.name}" has been copied to "${newMapName}"`,
                              variant: "default"
                            });
                            // Refresh maps
                            refetchMaps();
                          } else {
                            toast({
                              title: "Failed to copy map",
                              description: data.error || "An error occurred",
                              variant: "destructive"
                            });
                          }
                        })
                        .catch(err => {
                          toast({
                            title: "Failed to copy map",
                            description: err.message || "An error occurred",
                            variant: "destructive"
                          });
                        });
                      }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Create Map Copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (!selectedMap) {
                          toast({
                            title: "No map selected",
                            description: "Please select a map first",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // This functionality would be implemented in a more complex system
                        // with multiple physical robots
                        toast({
                          title: "Feature in development",
                          description: "This feature will be available when multiple robots are supported",
                          variant: "default"
                        });
                      }}>
                        <MapIcon className="h-4 w-4 mr-2" />
                        Export Map Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {mapsLoading || !selectedMap ? (
                  <div className="flex items-center justify-center h-[500px] bg-muted/20 rounded-md">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading map data...</p>
                    </div>
                  </div>
                ) : (
                  <MapDigitalTwin robotSerial={PHYSICAL_ROBOT_SERIAL} />
                )}
              </CardContent>
              {selectedMap && (
                <CardFooter className="flex justify-between flex-col sm:flex-row gap-2">
                  <div className="text-sm">
                    <div className="font-medium">Selected Map:</div>
                    <div className="text-muted-foreground">
                      {maps?.find((m: RobotMap) => m.id === selectedMap)?.name || 'Map'}
                    </div>
                  </div>
                  <div>
                    <Badge variant="outline">
                      {maps?.find((m: RobotMap) => m.id === selectedMap)?.resolution.toFixed(3) || '0.050'} m/px
                    </Badge>
                  </div>
                </CardFooter>
              )}
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map Assignments</CardTitle>
              <CardDescription>
                Manage which maps are assigned to each robot
              </CardDescription>
            </CardHeader>
            <CardContent>
              {robotsLoading || mapsLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Robot Serial</TableHead>
                      <TableHead>Assigned Map</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {robots && robots.map((robot: any) => (
                      <TableRow key={robot.serialNumber}>
                        <TableCell className="font-medium">
                          {robot.serialNumber}
                        </TableCell>
                        <TableCell>
                          {robot.currentMap?.name || 'No map assigned'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={robot.currentMap ? "default" : "secondary"} className={robot.currentMap ? "bg-green-500" : ""}>
                            {robot.currentMap ? "Active" : "Not Set"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Assign
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {maps && maps.map((map: RobotMap) => (
                                <DropdownMenuItem key={map.id}>
                                  {robot.currentMap?.id === map.id && (
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                  )}
                                  {map.name}
                                </DropdownMenuItem>
                              ))}
                              <Separator />
                              <DropdownMenuItem>
                                Create New Map Assignment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RobotMapsPage;