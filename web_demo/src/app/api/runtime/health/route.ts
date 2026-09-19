export async function GET() {
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  let connected = false;

  try {
    const response = await fetch(`${runtimeUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      connected =
        typeof payload === "object" &&
        payload !== null &&
        "status" in payload &&
        payload.status === "ok";
    }
  } catch {
    // An unavailable runtime is a normal connection state.
  }

  return Response.json(
    { connected },
    { headers: { "Cache-Control": "no-store" } },
  );
}
