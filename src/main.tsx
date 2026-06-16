import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import "@mysten/dapp-kit/dist/index.css";
import { networkConfig, suiNetwork } from "@/lib/sui";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider defaultNetwork={suiNetwork} networks={networkConfig}>
        <WalletProvider autoConnect preferredWallets={["Google"]}>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
