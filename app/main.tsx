import React from 'react';
import ReactDOM from 'react-dom/client';
import { Route, Switch } from 'wouter';
import LoginPage from './components/auth/LoginPage';
import TaskSelectionPage from './components/TaskSelectionPage';
import TrashPage from './components/TrashPage';
import LaundryPage from './components/LaundryPage';
import PickupDropoff from './components/PickupDropoff';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './lib/auth/AuthContext';
import { ToastProvider } from './components/ui/toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <Switch>
          <Route path="/" component={LoginPage} />
          <Route path="/tasks" component={() => <ProtectedRoute component={TaskSelectionPage} />} />
          <Route path="/trash" component={() => <ProtectedRoute component={TrashPage} />} />
          <Route path="/trash/pickup" component={() => <ProtectedRoute component={() => <PickupDropoff type="trash" />} />} />
          <Route path="/trash/dropoff" component={() => <ProtectedRoute component={() => <PickupDropoff type="trash" />} />} />
          <Route path="/laundry" component={() => <ProtectedRoute component={LaundryPage} />} />
          <Route path="/laundry/pickup" component={() => <ProtectedRoute component={() => <PickupDropoff type="laundry" />} />} />
          <Route path="/laundry/dropoff" component={() => <ProtectedRoute component={() => <PickupDropoff type="laundry" />} />} />
          <Route>404: Page Not Found</Route>
        </Switch>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
); 