import React from 'react';
import { Link } from 'wouter';
import { useAuth } from '../../providers/AuthProvider';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/">
            <a className="text-2xl font-bold text-red-500 hover:text-red-400 transition-colors">
              Zombie Survival
            </a>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span>Welcome, {user.username}</span>
                <button 
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login">
                <a className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors">
                  Login
                </a>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 py-4 text-center text-gray-400">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Zombie Survival Game. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;