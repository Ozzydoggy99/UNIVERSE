import React from 'react';
import { Route, Redirect } from 'wouter';
import { useAuth } from '../../providers/AuthProvider';

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  path: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  component: Component,
  ...rest
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Route
      {...rest}
      component={(props: any) =>
        user ? (
          <Component {...props} user={user} />
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  );
};