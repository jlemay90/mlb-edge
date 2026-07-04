import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import App from "./App";
import "./index.css";
import type { AppRouter } from "../server/routers";

export const trpc = createTRPCReact<AppRouter>();

function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } } }));
  const [trpcClient] = useState(() => trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc" })] }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TrpcProvider>
        <App />
      </TrpcProvider>
    </BrowserRouter>
  </React.StrictMode>
);
