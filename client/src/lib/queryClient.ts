import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Default robot configuration
const DEFAULT_ROBOT = {
  serialNumber: 'L382502104987ir',
  appcode: '667a51a4d948433081a272c78d10a8a4'
};

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  const method = options?.method || 'GET';
  const data = options?.data;
  const customHeaders = options?.headers || {};
  
  // Add Secret header to all API requests when it involves robots
  // The secret is needed for robot authentication
  const headers: Record<string, string> = {
    ...customHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  
  // Add APPCODE header for robot authentication
  if (url.includes('robots') || url.includes('robot') || url.includes('simplified-workflow')) {
    headers['APPCODE'] = DEFAULT_ROBOT.appcode;
  }
  
  try {
    // Add retry logic for transient network issues
    let retryCount = 0;
    const MAX_RETRIES = 2;
    
    while (retryCount <= MAX_RETRIES) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        
        // Don't throw on non-OK responses, let the caller handle them
        return res;
      } catch (fetchError) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          throw fetchError;
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = 200 * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // This should never be reached due to the while loop, but TypeScript needs it
    throw new Error("Failed after retries");
  } catch (error) {
    // Skip logging for robot API calls to reduce console noise
    // We'll only keep logs for critical API endpoints
    if (!url.includes('robot')) {
      console.error(`API request failed for ${url}:`, error);
    }
    
    // Return a fake response object to avoid breaking the app
    // The caller can check the ok property to know it failed
    return new Response(JSON.stringify({
      error: "Failed to connect to server",
      connectionStatus: "error"
    }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add Secret header for robot authentication
    const url = queryKey[0] as string;
    const headers: Record<string, string> = {};
    
    // If the URL contains "robots", "robot", or "simplified-workflow", add the Secret header
    if (url.includes('robots') || url.includes('robot') || url.includes('simplified-workflow')) {
      headers['APPCODE'] = DEFAULT_ROBOT.appcode;
    }
    
    try {
      // Use our improved apiRequest that has built-in retry
      const res = await apiRequest(url, { headers });
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      // Don't throw on non-OK responses for robot endpoints
      // Instead, handle them gracefully for better UX
      if (!res.ok) {
        if (url.includes('robot') || url.includes('simplified-workflow')) {
          const data = await res.json().catch(() => ({}));
          return {
            ...data,
            connectionStatus: 'error'
          };
        } else {
          // For non-robot endpoints, we still want to throw
          await throwIfResNotOk(res);
        }
      }
      
      return await res.json();
    } catch (error) {
      // Skip logging for robot endpoints to reduce console noise
      if (!url.includes('robot')) {
        console.error(`Query function error for ${url}:`, error);
      }
      
      if (url.includes('robot')) {
        // Return appropriate error object based on endpoint type
        if (url.includes('/status/')) {
          return {
            model: "AxBot Physical Robot",
            serialNumber: url.split('/').pop() || "",
            battery: 0,
            status: "offline",
            connectionStatus: "error",
            operationalStatus: "error"
          };
        } else if (url.includes('/position/')) {
          return {
            x: 0, y: 0, z: 0,
            orientation: 0,
            speed: 0,
            connectionStatus: "error",
            timestamp: new Date().toISOString()
          };
        } else if (url.includes('/sensors/')) {
          return {
            temperature: 0,
            humidity: 0,
            battery: 0,
            connectionStatus: "error",
            timestamp: new Date().toISOString(),
            charging: false,
            power_supply_status: 'unknown'
          };
        } else if (url.includes('/map/')) {
          return {
            grid: [],
            obstacles: [],
            paths: [],
            connectionStatus: "error"
          };
        } else if (url.includes('/camera/')) {
          return { 
            enabled: false,
            streamUrl: '',
            resolution: {
              width: 0,
              height: 0
            },
            rotation: 0,
            nightVision: false,
            timestamp: new Date().toISOString(),
            connectionStatus: "error"
          };
        } else {
          return { connectionStatus: "error" };
        }
      }
      
      // Re-throw for non-robot endpoints
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
