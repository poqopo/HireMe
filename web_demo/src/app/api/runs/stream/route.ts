export async function POST(request: Request) {
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  const runtimeToken = process.env.HIREME_MCP_TOKEN;
  try {
    const response = await fetch(`${runtimeUrl}/runs/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(runtimeToken ? { authorization: `Bearer ${runtimeToken}` } : {}),
      },
      body: request.body,
      duplex: "half",
      cache: "no-store",
    } as RequestInit);
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  } catch {
    return Response.json({ detail: "HireMe Agent Runtime에 연결할 수 없습니다." }, { status: 503 });
  }
}
