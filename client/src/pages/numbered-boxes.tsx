import React from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

// Define consistent colors for box numbers
const BOX_COLORS = {
  1: '#FF5252', // Red
  2: '#4CAF50', // Green
  3: '#2196F3', // Blue
  4: '#FFC107', // Amber
  5: '#9C27B0', // Purple
  6: '#FF9800', // Orange
  7: '#00BCD4', // Cyan
  8: '#795548', // Brown
  9: '#607D8B', // Blue Gray
  10: '#E91E63', // Pink
};

interface NumberedBoxesProps {
  user: User | null;
}

export default function NumberedBoxes({ user }: NumberedBoxesProps) {
  const { logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [activeBox, setActiveBox] = React.useState<number | null>(null);
  const [lastActivated, setLastActivated] = React.useState<number | null>(null);
  
  // Determine how many boxes to show based on user's template
  const totalBoxes = user?.templateId === 1 ? 6 : 10;
  
  // Handle box click to show active state
  const handleBoxClick = (boxNumber: number) => {
    setActiveBox(boxNumber);
    setLastActivated(boxNumber);
    
    // Reset active state after 1 second
    setTimeout(() => {
      setActiveBox(null);
    }, 1000);
  };
  
  // Return to the main template page
  const handleBackClick = () => {
    navigate('/my-template');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 relative">
      {/* Skytech Logo in top-left */}
      <div className="absolute top-4 left-4 text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent px-2 py-1 border-l-2 border-green-500">
        SKYTECH
      </div>
      
      {/* Logout Button */}
      <button 
        className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition-transform"
        onClick={() => logoutMutation.mutate()}
        aria-label="Logout"
      >
        <LogOut className="h-6 w-6 text-red-600 drop-shadow-glow-red" />
      </button>
      
      {/* Back Button */}
      <button 
        className="absolute top-4 left-16 ml-6 text-sm text-gray-700 hover:underline"
        onClick={handleBackClick}
      >
        ← Back to Main
      </button>
      
      <div className="pt-16 pb-8">
        <h1 className="text-2xl font-bold text-center mb-4">Control Buttons</h1>
        
        {lastActivated && (
          <div className="text-center mb-6 bg-white p-3 rounded-lg shadow-sm max-w-sm mx-auto">
            <p className="text-lg">
              Button <span className="font-bold" style={{color: BOX_COLORS[lastActivated as keyof typeof BOX_COLORS]}}>{lastActivated}</span> activated
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
          {Array.from({ length: totalBoxes }).map((_, index) => {
            const boxNumber = index + 1;
            return (
              <button
                key={boxNumber}
                className={`aspect-square rounded-lg relative flex items-center justify-center 
                         shadow-md hover:shadow-lg transform transition-all
                         border-2 border-white/30 overflow-hidden
                         ${activeBox === boxNumber ? 'scale-95 brightness-90' : 'hover:translate-y-[-2px]'}`}
                style={{
                  backgroundColor: BOX_COLORS[boxNumber as keyof typeof BOX_COLORS],
                }}
                onClick={() => handleBoxClick(boxNumber)}
              >
                <div className="absolute inset-0 border-4 border-white/10 rounded-lg pointer-events-none"></div>
                <div className="text-white font-bold text-3xl tracking-wide px-4 py-2 bg-black/20 rounded-md shadow-inner border border-white/20 text-shadow-sm">
                  {boxNumber}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-black/30 to-transparent"></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}