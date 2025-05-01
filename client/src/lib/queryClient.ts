import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

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
  
  // Add Secret header to all API requests
  // The secret is set on the server, this is a no-op on client
  // But ensures consistent headers across client and server
  const headers = {
    ...customHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add Secret header for robot authentication
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        // If the URL contains "robots" or "robot", add the Secret header
        // This is to ensure authentication for robot API endpoints
        ...(queryKey[0].toString().includes('robot') ? { 'Secret': import.meta.env.VITE_ROBOT_SECRET || '' } : {})
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
