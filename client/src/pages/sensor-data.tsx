import { ConnectionStatus } from "@/components/status/connection-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RobotSensorCard } from "@/components/robot/sensor-card";
import { useRobot } from "@/providers/robot-provider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

// Simulated historical data for charts
const generateHistoricalData = (current: number | undefined, name: string) => {
  if (current === undefined) return [];
  
  const data = [];
  let value = current;
  for (let i = 30; i >= 0; i--) {
    // Generate some random variations around the current value
    const randomVariation = (Math.random() - 0.5) * (current * 0.2);
    value = current + randomVariation;
    data.push({
      time: `${i} min ago`,
      [name]: parseFloat(value.toFixed(1))
    });
  }
  return data;
};

export default function SensorData() {
  const { robotSensorData } = useRobot();
  const [tempData, setTempData] = useState<any[]>([]);
  const [humidityData, setHumidityData] = useState<any[]>([]);
  const [proximityData, setProximityData] = useState<any[]>([]);
  const [lightData, setLightData] = useState<any[]>([]);
  const [noiseData, setNoiseData] = useState<any[]>([]);

  useEffect(() => {
    if (robotSensorData) {
      setTempData(generateHistoricalData(robotSensorData.temperature, "temperature"));
      setHumidityData(generateHistoricalData(robotSensorData.humidity, "humidity"));
      setProximityData(generateHistoricalData(robotSensorData.proximity, "proximity"));
      setLightData(generateHistoricalData(robotSensorData.light, "light"));
      setNoiseData(generateHistoricalData(robotSensorData.noise, "noise"));
    }
  }, [robotSensorData]);

  const getSensorStatusBadge = (value: number | undefined, thresholds: [number, number]) => {
    if (value === undefined) return <Badge variant="outline">Unknown</Badge>;
    
    if (value < thresholds[0]) {
      return <Badge variant="destructive">Low</Badge>;
    } else if (value > thresholds[1]) {
      return <Badge variant="destructive">High</Badge>;
    } else {
      return <Badge variant="outline" className="bg-success text-white">Normal</Badge>;
    }
  };

  return (
    <>
      <ConnectionStatus />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <RobotSensorCard />
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Sensor Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Temperature:</span>
                  {getSensorStatusBadge(robotSensorData?.temperature, [10, 35])}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Humidity:</span>
                  {getSensorStatusBadge(robotSensorData?.humidity, [20, 70])}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Proximity:</span>
                  {getSensorStatusBadge(robotSensorData?.proximity, [0.5, Infinity])}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Light Level:</span>
                  {getSensorStatusBadge(robotSensorData?.light, [100, 1000])}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Noise Level:</span>
                  {getSensorStatusBadge(robotSensorData?.noise, [20, 70])}
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Alert Settings</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Temperature Range (°C)</span>
                      <span className="text-sm">10 - 35</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Humidity Range (%)</span>
                      <span className="text-sm">20 - 70</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Temperature History (°C)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tempData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => value.replace(' min ago', 'm')}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="temperature" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Humidity History (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={humidityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => value.replace(' min ago', 'm')}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="humidity" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Proximity History (m)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={proximityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => value.replace(' min ago', 'm')}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="proximity" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Environmental Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...lightData].slice(0, lightData.length - 15)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }} 
                    tickFormatter={(value) => value.replace(' min ago', 'm')}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="light" 
                    name="Light (lux)"
                    stroke="hsl(var(--chart-4))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="noise" 
                    name="Noise (dB)"
                    stroke="hsl(var(--chart-5))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
