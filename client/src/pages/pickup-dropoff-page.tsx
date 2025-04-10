import React from 'react';
import { useLocation } from 'wouter';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { LogOut } from 'lucide-react';

interface PickupDropoffPageProps {
  user: User | null;
  type: 'laundry' | 'trash';
}

export default function PickupDropoffPage({ user, type }: PickupDropoffPageProps) {
  const { logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  // Navigate back to main template
  const handleBackClick = () => {
    navigate('/my-template');
  };
  
  // Navigate to appropriate numbered boxes page
  const handleActionClick = (action: 'pickup' | 'dropoff') => {
    navigate(`/${type}/${action}/numbers`);
  };
  
  // Determine the title color based on type
  const getTitleColor = () => {
    // Template 1 = green theme, Template 2 = blue theme
    if (user?.templateId === 1) {
      return type === 'laundry' ? 'text-emerald-700' : 'text-emerald-700';
    } else {
      return type === 'laundry' ? 'text-blue-700' : 'text-blue-700';
    }
  };
  
  // Capitalize the service type
  const serviceTitle = type.charAt(0).toUpperCase() + type.slice(1);
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      {/* Skytech Logo in top-left */}
      <div className="absolute top-4 left-4 text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent px-2 py-1 border-l-2 border-green-500">
        SKYTECH
      </div>
      
      {/* Logout Button with username */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-sm font-medium">{user?.username}</span>
        <button 
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 cursor-pointer transition-all flex items-center"
          onClick={() => logoutMutation.mutate()}
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
      
      {/* Back Button */}
      <button 
        className="absolute top-4 left-16 ml-6 text-sm text-gray-700 hover:underline"
        onClick={handleBackClick}
      >
        ← Back
      </button>
      
      <div className="pt-20 pb-10">
        <h1 className={`text-3xl font-bold text-center mb-10 ${getTitleColor()}`}>
          {serviceTitle} Service
        </h1>
        
        <div className="max-w-lg mx-auto grid grid-cols-1 gap-8">
          {/* Pickup Button - White with black text */}
          <button
            onClick={() => handleActionClick('pickup')}
            className="p-6 rounded-lg bg-white text-black border-2 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg transition-all"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Pickup</h2>
              <p className="text-gray-700">Pick up {type} from a box</p>
            </div>
          </button>
          
          {/* Dropoff Button - Black with white text */}
          <button
            onClick={() => handleActionClick('dropoff')}
            className="p-6 rounded-lg bg-black text-white border-2 border-black hover:bg-gray-900 shadow-md hover:shadow-lg transition-all"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Dropoff</h2>
              <p className="text-gray-300">Drop off {type} to a box</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}