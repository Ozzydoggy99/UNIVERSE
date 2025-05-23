import React from 'react';
import { useActivityTimeout } from '../../lib/hooks/useActivityTimeout';

interface ActivityTimeoutWrapperProps {
  children: React.ReactNode;
}

export default function ActivityTimeoutWrapper({ children }: ActivityTimeoutWrapperProps) {
  useActivityTimeout();
  return <>{children}</>;
} 