import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useAuth } from '../../lib/auth/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isCreatingAccount) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || 'Registration failed');
          } catch (parseError) {
            throw new Error(`Registration failed - server error (${response.status})`);
          }
        }

        const data = await response.json();
        if (data.success) {
          // Automatically log in after successful registration
          login(data.token || 'dummy-token');
          setLocation('/tasks');
        } else {
          throw new Error('Registration failed - invalid response format');
        }
      } else {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || 'Login failed');
          } catch (parseError) {
            throw new Error(`Login failed - server error (${response.status})`);
          }
        }

        const data = await response.json();
        if (data.success) {
          login(data.token || 'dummy-token');
          setLocation('/tasks');
        } else {
          throw new Error('Login failed - invalid response format');
        }
      }
    } catch (err) {
      console.error(isCreatingAccount ? 'Registration error:' : 'Login error:', err);
      setError(err instanceof Error ? err.message : isCreatingAccount ? 'Registration failed' : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsCreatingAccount(!isCreatingAccount);
    setError('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">
            {isCreatingAccount ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-center">
            {isCreatingAccount ? 'Create your new account' : 'Please sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>
            {isCreatingAccount && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (isCreatingAccount ? "Creating Account..." : "Signing in...") : 
                          (isCreatingAccount ? "Create Account" : "Sign in")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <button
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isCreatingAccount ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
          {!isCreatingAccount && (
            <p className="text-sm text-gray-600 w-full text-center">
              Use test/test to login
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 