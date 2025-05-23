import React, { useEffect } from 'react';
import { Link, useLocation, Redirect } from 'wouter';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const isAuthenticated = localStorage.getItem('adminAuthenticated') === 'true';

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/admin/login');
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated');
    setLocation('/admin/login');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard' },
    { path: '/admin/robots', label: 'Robots' },
    { path: '/admin/robot-registration', label: 'Robot Registration' },
    { path: '/admin/robot-assignment', label: 'Robot Assignment' },
    { path: '/admin/maps', label: 'Maps' },
    { path: '/admin/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-green-500">Skytech Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Admin</span>
              <button 
                onClick={handleLogout}
                className="text-gray-300 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-gray-900 min-h-screen border-r border-gray-800">
          <div className="px-4 py-6">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`block px-4 py-2 rounded-md ${
                      location === item.path
                        ? 'bg-green-500 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 