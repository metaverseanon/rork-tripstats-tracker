import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    console.error('[TRPC] EXPO_PUBLIC_RORK_API_BASE_URL is not set');
    return 'https://api.placeholder.invalid';
  }

  console.log('[TRPC] Base URL:', url);
  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        console.log('[TRPC] Request:', url);
        console.log('[TRPC] Method:', options?.method || 'GET');
        try {
          const response = await fetch(url, options);
          console.log('[TRPC] Response status:', response.status);
          console.log('[TRPC] Response URL:', response.url);
          
          const contentType = response.headers.get('content-type') || '';
          console.log('[TRPC] Content-Type:', contentType);
          
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[TRPC] Non-JSON response:', text.substring(0, 500));
            throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
          }
          
          if (!response.ok) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('[TRPC] Error response body:', text);
            
            try {
              const errorJson = JSON.parse(text);
              console.error('[TRPC] Error JSON:', errorJson);
              if (errorJson.error?.message) {
                throw new Error(errorJson.error.message);
              }
              if (errorJson.path) {
                console.error('[TRPC] 404 for path:', errorJson.path);
              }
            } catch (parseErr) {
              // Not JSON or parse failed
            }
            
            throw new Error(`Server error: ${response.status}`);
          }
          
          return response;
        } catch (error) {
          console.error('[TRPC] Fetch error:', error);
          throw error;
        }
      },
    }),
  ],
});
