"use client";

import { createDAppKit, DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

const dAppKit = createDAppKit({
  networks: ["testnet"],
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: "https://fullnode.testnet.sui.io:443",
    }),
  slushWalletConfig:
    typeof window === "undefined"
      ? null
      : {
          appName: "HireMe",
          metadataApiUrl: `${window.location.origin}/api/slush/metadata`,
        },
  autoConnect: true,
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DAppKitProvider dAppKit={dAppKit}>{children}</DAppKitProvider>;
}
