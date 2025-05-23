import React, { useState } from 'react';
import { useLocation, useRoute } from 'wouter';

interface PickupDropoffProps {
  type: 'trash' | 'laundry';
}

const PickupDropoff: React.FC<PickupDropoffProps> = ({ type }) => {
  const [floorNumber, setFloorNumber] = useState<string>('');
  const [shelfNumber, setShelfNumber] = useState<string>('');
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/:type/:action');
  const action = params?.action || '';
  
  const handleSubmit = () => {
    const floor = parseInt(floorNumber);
    const shelf = parseInt(shelfNumber);
    
    if (!floor || !shelf || floor < 1 || shelf < 1) {
      alert('Please enter valid floor and shelf numbers (must be positive numbers)');
      return;
    }
    
    // TODO: Implement submission logic
    console.log(`${action} ${type} at Floor ${floor}, Shelf ${shelf}`);
  };

  const handleNumberInput = (value: string, setter: (value: string) => void) => {
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setter(value);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-6 md:p-8 space-y-8">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2 capitalize">
            {action} {type}
          </h2>
          <p className="text-gray-600 text-lg">
            Please enter the location details
          </p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="floorNumber" className="block text-lg font-medium text-gray-700 mb-2">
              Floor Number
            </label>
            <input
              type="text"
              id="floorNumber"
              inputMode="numeric"
              pattern="\d*"
              value={floorNumber}
              onChange={(e) => handleNumberInput(e.target.value, setFloorNumber)}
              placeholder="Enter floor number"
              className="w-full h-14 text-lg px-4 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="shelfNumber" className="block text-lg font-medium text-gray-700 mb-2">
              Shelf Number
            </label>
            <input
              type="text"
              id="shelfNumber"
              inputMode="numeric"
              pattern="\d*"
              value={shelfNumber}
              onChange={(e) => handleNumberInput(e.target.value, setShelfNumber)}
              placeholder="Enter shelf number"
              className="w-full h-14 text-lg px-4 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 text-white text-xl font-semibold py-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit
          </button>
          
          <button
            onClick={() => setLocation(`/${type}`)}
            className="w-full bg-gray-100 text-gray-700 text-lg font-medium py-3 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PickupDropoff; 