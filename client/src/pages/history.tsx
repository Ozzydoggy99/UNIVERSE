import { ConnectionStatus } from "@/components/status/connection-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CalendarIcon, FileDown, Search, RefreshCw } from "lucide-react";
import { useState } from "react";

// Sample history data
const historyData = [
  { id: 1, timestamp: "2023-06-15 14:30:22", event: "Robot started", status: "info" },
  { id: 2, timestamp: "2023-06-15 14:32:45", event: "Navigation started", status: "info" },
  { id: 3, timestamp: "2023-06-15 14:35:12", event: "Obstacle detected", status: "warning" },
  { id: 4, timestamp: "2023-06-15 14:35:30", event: "Rerouting", status: "info" },
  { id: 5, timestamp: "2023-06-15 14:38:10", event: "Destination reached", status: "success" },
  { id: 6, timestamp: "2023-06-15 14:45:22", event: "Battery low", status: "warning" },
  { id: 7, timestamp: "2023-06-15 14:47:30", event: "Returning to charging station", status: "info" },
  { id: 8, timestamp: "2023-06-15 14:50:15", event: "Charging started", status: "info" },
  { id: 9, timestamp: "2023-06-15 15:20:30", event: "Charging complete", status: "success" },
  { id: 10, timestamp: "2023-06-15 15:30:00", event: "System error detected", status: "error" },
  { id: 11, timestamp: "2023-06-15 15:30:15", event: "Rebooting system", status: "warning" },
  { id: 12, timestamp: "2023-06-15 15:32:00", event: "System online", status: "success" },
];

// Sample battery history data for chart
const batteryData = [
  { time: "14:00", battery: 85 },
  { time: "14:30", battery: 78 },
  { time: "15:00", battery: 65 },
  { time: "15:30", battery: 52 },
  { time: "16:00", battery: 40 },
  { time: "16:30", battery: 28 },
  { time: "17:00", battery: 15 },
  { time: "17:30", battery: 50 },
  { time: "18:00", battery: 65 },
  { time: "18:30", battery: 85 },
  { time: "19:00", battery: 100 },
];

// Sample speed history data for chart
const speedData = [
  { time: "14:00", speed: 0 },
  { time: "14:30", speed: 0.5 },
  { time: "15:00", speed: 0.8 },
  { time: "15:30", speed: 0.3 },
  { time: "16:00", speed: 0.7 },
  { time: "16:30", speed: 0.2 },
  { time: "17:00", speed: 0 },
  { time: "17:30", speed: 0 },
  { time: "18:00", speed: 0.4 },
  { time: "18:30", speed: 0.6 },
  { time: "19:00", speed: 0 },
];

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const filteredHistory = historyData.filter(item => {
    const matchesSearch = item.event.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.timestamp.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });
  
  const getStatusBadge = (status: string) => {
    switch(status) {
      case "info":
        return <Badge variant="secondary">Info</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-warning text-white">Warning</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "success":
        return <Badge variant="outline" className="bg-success text-white">Success</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <ConnectionStatus />
      
      <Card>
        <CardHeader>
          <CardTitle>Operation History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="events">
            <TabsList className="mb-4">
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="events">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex items-center w-full md:w-1/2">
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mr-2"
                  />
                  <Button variant="ghost" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-1/2">
                  <div className="flex-1">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Date Range
                  </Button>
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/4">Timestamp</TableHead>
                      <TableHead className="w-1/2">Event</TableHead>
                      <TableHead className="w-1/4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.timestamp}</TableCell>
                          <TableCell>{item.event}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4">
                          No events found matching your criteria
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {filteredHistory.length} of {historyData.length} events
                </span>
                <Button variant="outline" className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" />
                  Export Data
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="metrics">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Battery Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={batteryData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis tickFormatter={(value) => `${value}%`} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="battery" name="Battery Level" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Movement Speed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={speedData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis tickFormatter={(value) => `${value} m/s`} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="speed" name="Speed" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="mt-6">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">System Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">85%</div>
                        <div className="text-sm text-muted-foreground">Avg. Battery</div>
                      </div>
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">0.5 m/s</div>
                        <div className="text-sm text-muted-foreground">Avg. Speed</div>
                      </div>
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">15h 32m</div>
                        <div className="text-sm text-muted-foreground">Total Operation</div>
                      </div>
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">98.5%</div>
                        <div className="text-sm text-muted-foreground">Uptime</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
