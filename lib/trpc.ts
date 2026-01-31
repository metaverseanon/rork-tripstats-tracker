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
        const requestId = Math.random().toString(36).substring(7);
        console.log(`[TRPC:${requestId}] ========== REQUEST START ==========`);
        console.log(`[TRPC:${requestId}] URL:`, url);
        console.log(`[TRPC:${requestId}] Method:`, options?.method || 'GET');
        console.log(`[TRPC:${requestId}] Body:`, options?.body ? String(options.body).substring(0, 200) : 'none');
        try {
          const startTime = Date.now();
          const response = await fetch(url, options);
          const duration = Date.now() - startTime;
          console.log(`[TRPC:${requestId}] Response status:`, response.status);
          console.log(`[TRPC:${requestId}] Response URL:`, response.url);
          console.log(`[TRPC:${requestId}] Duration: ${duration}ms`);
          
          const contentType = response.headers.get('content-type') || '';
          console.log(`[TRPC:${requestId}] Content-Type:`, contentType);
          
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error(`[TRPC:${requestId}] Non-JSON response:`, text.substring(0, 500));
            console.log(`[TRPC:${requestId}] ========== REQUEST END (NON-JSON) ==========`);
            throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
          }
          
          if (!response.ok) {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error(`[TRPC:${requestId}] ERROR - Status: ${response.status}`);
            console.error(`[TRPC:${requestId}] ERROR - Body:`, text);
            
            try {
              const errorJson = JSON.parse(text);
              console.error(`[TRPC:${requestId}] ERROR - Parsed:`, JSON.stringify(errorJson));
              if (errorJson.path) {
                console.error(`[TRPC:${requestId}] ERROR - Path not found:`, errorJson.path);
              }
            } catch (parseErr) {
              console.error(`[TRPC:${requestId}] ERROR - Could not parse as JSON`);
            }
            
            console.log(`[TRPC:${requestId}] ========== REQUEST END (ERROR) ==========`);
            throw new Error(`Server error: ${response.status}`);
          }
          
          console.log(`[TRPC:${requestId}] ========== REQUEST END (SUCCESS) ==========`);
          return response;
        } catch (error) {
          console.error(`[TRPC:${requestId}] FETCH EXCEPTION:`, error);
          console.log(`[TRPC:${requestId}] ========== REQUEST END (EXCEPTION) ==========`);
          throw error;
        }
      },
    }),
  ],
});
