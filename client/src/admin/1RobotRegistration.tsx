import React, { useState } from 'react';

interface RobotRegistration {
  name: string;
  localIp: string;
  publicIp: string;
  secret: string;
  serialNumber: string;
}

const RobotRegistration: React.FC = () => {
  const [robot, setRobot] = useState<RobotRegistration>({
    name: '',
    localIp: '',
    publicIp: '',
    secret: '',
    serialNumber: ''
  });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/robots/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(robot),
      });

      if (!response.ok) {
        throw new Error('Failed to register robot');
      }

      setMessage({ text: 'Robot registered successfully', type: 'success' });
      setRobot({ name: '', localIp: '', publicIp: '', secret: '', serialNumber: '' });
    } catch (error) {
      setMessage({ text: 'Failed to register robot', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Robot Registration</h2>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">Robot Name:</label>
            <input
              type="text"
              value={robot.name}
              onChange={(e) => setRobot({ ...robot, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
              placeholder="e.g., Warehouse Bot 1"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Local IP:</label>
            <input
              type="text"
              value={robot.localIp}
              onChange={(e) => setRobot({ ...robot, localIp: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
              placeholder="e.g., 192.168.1.100"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Public IP:</label>
            <input
              type="text"
              value={robot.publicIp}
              onChange={(e) => setRobot({ ...robot, publicIp: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
              placeholder="e.g., 203.0.113.1"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Secret:</label>
            <input
              type="text"
              value={robot.secret}
              onChange={(e) => setRobot({ ...robot, secret: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
              placeholder="Robot secret key"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Serial Number:</label>
            <input
              type="text"
              value={robot.serialNumber}
              onChange={(e) => setRobot({ ...robot, serialNumber: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
              placeholder="Robot serial number"
              required
            />
          </div>

          {message && (
            <div className={`p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
          >
            Register Robot
          </button>
        </form>
      </div>
    </div>
  );
};

export default RobotRegistration; 