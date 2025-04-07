import { QueryClient } from '@tanstack/react-query';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.message || errorJson.error || 'An error occurred');
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(errorText || res.statusText || 'An error occurred');
      }
      throw e;
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
} = { on401: "throw" }) => {
  return async (obj: { queryKey: string[] }): Promise<T> => {
    const url = obj.queryKey[0];
    const res = await fetch(url);

    if (res.status === 401) {
      if (options.on401 === "returnNull") {
        return null as T;
      } else {
        throw new Error("Unauthorized");
      }
    }

    await throwIfResNotOk(res);
    return res.json();
  };
};

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, options);
  await throwIfResNotOk(res);
  
  // If no content, return null
  if (res.status === 204) {
    return null as T;
  }
  
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});