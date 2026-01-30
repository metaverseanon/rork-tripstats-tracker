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
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        console.log('[TRPC] Request:', url);
        try {
          const response = await fetch(url, options);
          console.log('[TRPC] Response status:', response.status);
          
          const contentType = response.headers.get('content-type') || '';
          
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[TRPC] Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned non-JSON response. Please try again.');
          }
          
          if (!response.ok) {
            const text = await response.text();
            console.error('[TRPC] Error response:', text.substring(0, 500));
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
