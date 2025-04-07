import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
        toast({
          title: "Login Successful",
          description: "Welcome back to Zombie Survival!",
        });
      } else {
        await register(username, password);
        toast({
          title: "Registration Successful",
          description: "Welcome to Zombie Survival!",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: "Please check your credentials and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-500">Zombie Survival</h1>
          <p className="mt-2 text-gray-400">
            {isLogin ? "Sign in to continue" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            disabled={loading}
          >
            {loading ? (
              <span>Loading...</span>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Sign Up"
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <p className="text-gray-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 text-red-400 hover:text-red-300 focus:outline-none"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;