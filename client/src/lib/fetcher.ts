/**
 * Simple fetch wrapper for API calls
 * 
 * @param url The URL to fetch from
 * @param options Optional fetch options
 * @returns Promise resolving to the JSON response
 */
export async function fetcher<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch (e) {
      // If the error response isn't valid JSON, use the text as is
      if (errorText) {
        errorMessage = errorText;
      }
    }
    
    throw new Error(errorMessage);
  }

  // For empty responses or 204 No Content
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  return response.json();
}