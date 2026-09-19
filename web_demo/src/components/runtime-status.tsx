"use client";

import { useEffect, useState } from "react";

type ConnectionState = "checking" | "connected" | "disconnected";
const labels: Record<ConnectionState, string> = {
  checking: "Runtime 확인 중",
  connected: "Runtime 연결됨",
  disconnected: "Runtime 연결 안 됨",
};

export default function RuntimeStatus() {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      let connected = false;
      try {
        const response = await fetch("/api/runtime/health", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5_000),
          ]),
        });
        if (response.ok) {
          const payload = await response.json();
          connected = payload.connected === true;
        }
      } catch {
        // Keep the status disconnected until the next successful check.
      }
      if (controller.signal.aborted) return;
      setState(connected ? "connected" : "disconnected");
      timer = setTimeout(check, 10_000);
    }

    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <span
      className={`runtime-status ${state}`}
      role="status"
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      {labels[state]}
    </span>
  );
}
