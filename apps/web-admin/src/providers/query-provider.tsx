'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

// Cache time constants for different data types
export const CACHE_TIMES = {
  // Static/rarely changing data (roles, permissions, settings)
  STATIC: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  // Frequently accessed but slow changing data (users, entities)
  STANDARD: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  // Data that changes often (dashboard stats, notifications)
  DYNAMIC: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  // Real-time data (should always refetch)
  REALTIME: {
    staleTime: 0,
    gcTime: 1 * 60 * 1000, // 1 minute
  },
};

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default: Data is considered fresh for 5 minutes
            staleTime: CACHE_TIMES.STANDARD.staleTime,
            // Default: Cache is kept for 30 minutes
            gcTime: CACHE_TIMES.STANDARD.gcTime,
            // Retry failed requests 1 time
            retry: 1,
            // Exponential backoff for retries
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Don't refetch on window focus by default (reduces API calls)
            refetchOnWindowFocus: false,
            // Refetch on reconnect to ensure fresh data
            refetchOnReconnect: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: true,
            // Use stale data while revalidating
            placeholderData: (previousData: unknown) => previousData,
          },
          mutations: {
            // Don't retry failed mutations (user should retry manually)
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
