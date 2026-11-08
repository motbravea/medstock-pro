import { QueryClient } from "@tanstack/react-query";

/**
 * Single shared TanStack Query client. Exported so the auth store can clear
 * cached responses on sign-out — otherwise Admin data could flash briefly
 * when a Staff user logs in on the same workstation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
