import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../components/ui/toast';

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_BEFORE = 60 * 1000; // 1 minute warning before logout

export function useActivityTimeout() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let warningTimeoutId: NodeJS.Timeout;

    const handleLogout = () => {
      logout();
      setLocation('/');
    };

    const showWarning = () => {
      showToast('You will be logged out in 1 minute due to inactivity', 'warning');
    };

    const resetTimeout = () => {
      // Clear both timeouts
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (warningTimeoutId) {
        clearTimeout(warningTimeoutId);
      }

      // Set warning timeout
      warningTimeoutId = setTimeout(showWarning, TIMEOUT_DURATION - WARNING_BEFORE);
      
      // Set logout timeout
      timeoutId = setTimeout(handleLogout, TIMEOUT_DURATION);
    };

    // List of events to track
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Set up initial timeout
    resetTimeout();

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (warningTimeoutId) {
        clearTimeout(warningTimeoutId);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, [logout, setLocation, showToast]);
} 