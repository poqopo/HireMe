import {
  getOpenAICodexAuthStatus,
  loginOpenAICodex,
  logoutOpenAICodex,
} from "../agent/src/openaiCodexProvider.mjs";

/**
 * Desktop provider adapters own authentication and runtime configuration.
 * HireMe's agent runtime only receives the normalized provider id and env.
 */
export function createOpenAICodexProviderAdapter({
  getAuthStatus = getOpenAICodexAuthStatus,
  login = loginOpenAICodex,
  logout = logoutOpenAICodex,
  openExternal,
  loginTimeoutMs = 10 * 60_000,
} = {}) {
  return {
    id: "codex",
    runtimeProvider: "openai-codex",

    async inspect({ authPath, connecting = false }) {
      if (connecting) {
        return providerStatus({ connected: false, connecting: true });
      }
      try {
        const status = await getAuthStatus({ authPath });
        return providerStatus({ connected: status.configured === true });
      } catch (error) {
        return providerStatus({
          connected: false,
          error: publicAuthError(error),
        });
      }
    },

    async connect({ authPath, signal }) {
      return login({
        authPath,
        originator: "hireme",
        signal,
        timeoutMs: loginTimeoutMs,
        openBrowser: typeof openExternal !== "function",
        onAuth: typeof openExternal === "function"
          ? ({ url }) => openExternal(url)
          : undefined,
      });
    },

    async disconnect({ authPath }) {
      await logout({ authPath });
    },

    runtime({ authPath, imageBridgeCommand, imageBridgeArgs, imageTimeoutMs }) {
      return {
        provider: "openai-codex",
        model: null,
        env: {
          HIREME_OPENAI_CODEX_AUTH_PATH: authPath,
          HIREME_CODEX_IMAGE_GEN_COMMAND: imageBridgeCommand || "",
          HIREME_CODEX_IMAGE_GEN_ARGS: JSON.stringify((imageBridgeArgs || []).map(String)),
          HIREME_CODEX_IMAGE_GEN_TIMEOUT_MS: String(imageTimeoutMs),
          OPENAI_API_KEY: "",
        },
      };
    },
  };
}

function providerStatus({ connected, connecting = false, error = null }) {
  return {
    installed: true,
    connected,
    connecting,
    status: connecting ? "connecting" : error ? "error" : connected ? "connected" : "not_connected",
    error,
  };
}

function publicAuthError(error) {
  const message = String(error?.message || error || "");
  if (/timed out/i.test(message)) return "ChatGPT 연결 상태 확인이 지연되고 있습니다.";
  return "ChatGPT 연결 상태를 확인하지 못했습니다.";
}
