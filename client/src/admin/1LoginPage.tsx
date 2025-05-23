import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const isAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';

  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/admin/dashboard');
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'Ozzydog' && password === 'Ozzydog') {
      localStorage.setItem('adminAuthenticated', 'true');
      setLocation('/admin/dashboard');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-lg shadow-xl w-96">
        <h1 className="text-4xl font-bold text-green-500 text-center mb-8">
          Skytech Automated
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-gray-300 mb-2">User:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 mb-2">Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-green-500"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage; 