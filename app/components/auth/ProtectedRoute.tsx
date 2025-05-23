import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../../lib/auth/AuthContext';
import ActivityTimeoutWrapper from './ActivityTimeoutWrapper';

interface ProtectedRouteProps {
  component: React.ComponentType;
}

export default function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ActivityTimeoutWrapper>
      <Component />
    </ActivityTimeoutWrapper>
  );
} 