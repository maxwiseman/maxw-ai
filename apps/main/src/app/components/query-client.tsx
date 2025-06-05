"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  QueryClientProvider as Provider,
  QueryClient,
} from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : null,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
});

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider client={queryClient}>{children}</Provider>;
}
