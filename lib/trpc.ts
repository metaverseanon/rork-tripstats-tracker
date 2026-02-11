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

const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 30000;

const fetchWithTimeout = async (url: RequestInfo | URL, options: RequestInit | undefined, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof TypeError) {
    const msg = String(error.message).toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network request failed') || msg.includes('load failed');
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  return false;
};

const fetchWithRetry = async (url: RequestInfo | URL, options: RequestInit | undefined, requestId: string, attempt = 1): Promise<Response> => {
  try {
    const startTime = Date.now();
    const response = await fetchWithTimeout(url, options, REQUEST_TIMEOUT_MS);
    const duration = Date.now() - startTime;
    console.log(`[TRPC:${requestId}] Response status: ${response.status} (${duration}ms, attempt ${attempt})`);

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`[TRPC:${requestId}] Non-JSON response:`, text.substring(0, 500));
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`[TRPC:${requestId}] Non-JSON on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, requestId, attempt + 1);
      }
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      console.error(`[TRPC:${requestId}] ERROR ${response.status}:`, text.substring(0, 300));
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`[TRPC:${requestId}] Server error on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, requestId, attempt + 1);
      }
      throw new Error(`Server error: ${response.status}`);
    }

    return response;
  } catch (error) {
    if (isRetryableError(error) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      const errorName = error instanceof DOMException ? 'Timeout' : 'Network error';
      console.warn(`[TRPC:${requestId}] ${errorName} on attempt ${attempt}, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, requestId, attempt + 1);
    }
    console.error(`[TRPC:${requestId}] FETCH FAILED after ${attempt} attempt(s):`, error);
    throw error;
  }
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        const requestId = Math.random().toString(36).substring(7);
        console.log(`[TRPC:${requestId}] ${options?.method || 'GET'} ${String(url).substring(0, 120)}`);
        return fetchWithRetry(url, options, requestId);
      },
    }),
  ],
});
