import React from 'react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-gray-400 text-sm">Active Robots</h3>
          <div className="mt-2">
            <p className="text-2xl font-semibold text-white">-</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-gray-400 text-sm">Total Maps</h3>
          <div className="mt-2">
            <p className="text-2xl font-semibold text-white">-</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-gray-400 text-sm">Tasks Today</h3>
          <div className="mt-2">
            <p className="text-2xl font-semibold text-white">-</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-gray-400 text-sm">System Status</h3>
          <div className="mt-2">
            <p className="text-2xl font-semibold text-white">-</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-medium text-white">Recent Activity</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-gray-400">No recent activity</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">
            Add Robot
          </button>
          <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">
            Upload Map
          </button>
          <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">
            Run Test
          </button>
          <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors">
            View Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 