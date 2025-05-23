import React from 'react';
import { useLocation } from 'wouter';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function LaundryPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-5xl">
        <CardHeader className="pb-2 md:pb-6">
          <CardTitle className="text-2xl md:text-4xl font-bold text-center">Laundry Collection Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 md:space-y-12 p-4 md:p-8">
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <Button
                onClick={() => setLocation('/laundry/pickup')}
                className="h-48 md:h-64 text-3xl md:text-4xl font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Pick Up Laundry
              </Button>
              <Button
                onClick={() => setLocation('/laundry/dropoff')}
                className="h-48 md:h-64 text-3xl md:text-4xl font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Drop Off Laundry
              </Button>
            </div>
            
            <Button
              onClick={() => setLocation('/tasks')}
              variant="outline"
              className="w-full text-xl md:text-2xl py-8 rounded-xl"
            >
              ← Back to Task Selection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 