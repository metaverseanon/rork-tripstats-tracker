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
  return url;
};

const REQUEST_TIMEOUT_MS = 30000;

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          return response;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('[TRPC] Request timed out:', String(url).substring(0, 100));
          } else {
            console.warn('[TRPC] Fetch error:', error instanceof Error ? error.message : 'Unknown error');
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    }),
  ],
});
