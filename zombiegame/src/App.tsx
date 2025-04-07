import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import Game from "./pages/Game";
import Login from "./pages/Login";
import { AuthProvider } from "./providers/AuthProvider";
import MainLayout from "./components/layouts/MainLayout";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <ProtectedRoute 
        path="/" 
        component={() => (
          <MainLayout>
            <Game />
          </MainLayout>
        )} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;