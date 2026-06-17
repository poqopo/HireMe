import { registerEnokiWallets } from "@mysten/enoki";
import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from "@mysten/sui/jsonRpc";
import { createNetworkConfig } from "@mysten/dapp-kit";

const enokiApiKey = import.meta.env.VITE_ENOKI_PUBLIC_API_KEY as
  | string
  | undefined;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;
const configuredNetwork = (import.meta.env.VITE_SUI_NETWORK || "testnet") as
  | "devnet"
  | "testnet"
  | "mainnet";
const configuredFullnodeUrl =
  (import.meta.env.VITE_SUI_FULLNODE_URL as string | undefined) ||
  getJsonRpcFullnodeUrl(configuredNetwork);

export const isEnokiConfigured = Boolean(enokiApiKey && googleClientId);
export const suiNetwork = configuredNetwork;
const suiClientConfig = {
  url: configuredFullnodeUrl,
  network: configuredNetwork,
};

export const { networkConfig } = createNetworkConfig({
  [configuredNetwork]: suiClientConfig,
});

const suiClient = new SuiJsonRpcClient(suiClientConfig);

if (isEnokiConfigured) {
  registerEnokiWallets({
    apiKey: enokiApiKey!,
    client: suiClient,
    network: configuredNetwork,
    providers: {
      google: {
        clientId: googleClientId!,
        redirectUrl: `${window.location.origin}/auth/enoki/callback`,
      },
    },
  });
}
