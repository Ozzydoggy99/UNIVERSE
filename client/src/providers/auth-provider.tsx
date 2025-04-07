import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authenticate } from "@/lib/api";
import { AuthConfig } from "@/types/robot";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  apiEndpoint: string | null;
  authenticate: (apiKey: string, apiEndpoint: string, remember: boolean) => Promise<void>;
  logout: () => void;
  showAuthDialog: boolean;
  setShowAuthDialog: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Check for saved auth data on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem("axbot_auth");
    if (savedAuth) {
      try {
        const authData: AuthConfig = JSON.parse(savedAuth);
        // In a real app, we would validate that the saved token is still valid
        setApiEndpoint(authData.apiEndpoint);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Error parsing saved auth data:", error);
        localStorage.removeItem("axbot_auth");
      }
    } else {
      // Show auth dialog on first load if no saved auth
      setShowAuthDialog(true);
    }
  }, []);

  const handleAuthenticate = async (apiKey: string, endpoint: string, remember: boolean) => {
    setIsAuthenticating(true);
    try {
      await authenticate(apiKey, endpoint);
      
      setApiEndpoint(endpoint);
      setIsAuthenticated(true);
      
      if (remember) {
        const authData: AuthConfig = {
          apiEndpoint: endpoint,
          apiKey: apiKey,
          rememberConnection: true
        };
        localStorage.setItem("axbot_auth", JSON.stringify(authData));
      }
    } catch (error) {
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setApiEndpoint(null);
    localStorage.removeItem("axbot_auth");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthenticating,
        apiEndpoint,
        authenticate: handleAuthenticate,
        logout: handleLogout,
        showAuthDialog,
        setShowAuthDialog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
