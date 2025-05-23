import React from 'react';
import { useLocation } from 'wouter';
import { Button } from './ui/button';
import { useAuth } from '../lib/auth/AuthContext';

export default function TaskSelectionPage() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 flex justify-end">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="text-gray-600 hover:text-gray-800"
        >
          Logout
        </Button>
      </div>
      
      <div className="flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <h1 className="text-3xl font-bold mb-8">Select Task Type</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <Button
            onClick={() => setLocation('/trash')}
            className="h-48 text-2xl font-bold bg-green-600 hover:bg-green-700"
          >
            Trash
          </Button>
          <Button
            onClick={() => setLocation('/laundry')}
            className="h-48 text-2xl font-bold bg-blue-600 hover:bg-blue-700"
          >
            Laundry
          </Button>
        </div>
      </div>
    </div>
  );
} 