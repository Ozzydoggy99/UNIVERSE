import React, { useState, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';

interface Robot {
  name: string;
  localIp: string;
  publicIp: string;
  secret: string;
  serialNumber: string;
  createdAt: Date;
}

const RobotAssignment: React.FC = () => {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [expandedRobot, setExpandedRobot] = useState<string | null>(null);
  const [editingRobot, setEditingRobot] = useState<Robot | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch robots on component mount
  useEffect(() => {
    fetchRobots();
  }, []);

  const fetchRobots = async () => {
    try {
      const response = await fetch('/api/robots/robots');
      if (!response.ok) throw new Error('Failed to fetch robots');
      const data = await response.json();
      setRobots(data);
    } catch (error) {
      setMessage({ text: 'Failed to fetch robots', type: 'error' });
    }
  };

  const handleRobotClick = (serialNumber: string) => {
    if (expandedRobot === serialNumber) {
      setExpandedRobot(null);
      setEditingRobot(null);
    } else {
      setExpandedRobot(serialNumber);
      const robot = robots.find(r => r.serialNumber === serialNumber);
      if (robot) {
        setEditingRobot({ ...robot });
      }
    }
  };

  const handleInputChange = (field: keyof Robot, value: string) => {
    if (editingRobot) {
      setEditingRobot({ ...editingRobot, [field]: value });
    }
  };

  const handleUpdateRobot = async () => {
    if (!editingRobot) return;

    try {
      const response = await fetch(`/api/robots/robots/${editingRobot.serialNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingRobot),
      });

      if (!response.ok) throw new Error('Failed to update robot');

      setMessage({ text: 'Robot updated successfully', type: 'success' });
      fetchRobots(); // Refresh the list
      setExpandedRobot(null);
      setEditingRobot(null);
    } catch (error) {
      setMessage({ text: 'Failed to update robot', type: 'error' });
    }
  };

  const handleDeleteRobot = async (serialNumber: string) => {
    if (!window.confirm('Are you sure you want to delete this robot?')) return;

    try {
      const response = await fetch(`/api/robots/robots/${serialNumber}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete robot');

      setMessage({ text: 'Robot deleted successfully', type: 'success' });
      fetchRobots(); // Refresh the list
      setExpandedRobot(null);
      setEditingRobot(null);
    } catch (error) {
      setMessage({ text: 'Failed to delete robot', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Robot Assignment</h2>

      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {robots.map((robot) => (
          <div
            key={robot.serialNumber}
            className="bg-gray-900 rounded-lg border border-gray-800 p-4 cursor-pointer hover:border-green-500 transition-colors"
            onClick={() => handleRobotClick(robot.serialNumber)}
          >
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">{robot.name}</h3>
              <p className="text-gray-400">Serial: {robot.serialNumber}</p>

              {expandedRobot === robot.serialNumber && editingRobot && (
                <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-gray-300 mb-1">Name:</label>
                    <input
                      type="text"
                      value={editingRobot.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">Local IP:</label>
                    <input
                      type="text"
                      value={editingRobot.localIp}
                      onChange={(e) => handleInputChange('localIp', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">Public IP:</label>
                    <input
                      type="text"
                      value={editingRobot.publicIp}
                      onChange={(e) => handleInputChange('publicIp', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">Secret:</label>
                    <input
                      type="text"
                      value={editingRobot.secret}
                      onChange={(e) => handleInputChange('secret', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <button
                      onClick={handleUpdateRobot}
                      className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
                    >
                      Confirm Changes
                    </button>
                    <button
                      onClick={() => handleDeleteRobot(robot.serialNumber)}
                      className="text-red-500 hover:text-red-600 transition-colors p-2"
                    >
                      <FaTrash size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RobotAssignment; 