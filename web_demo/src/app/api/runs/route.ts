export async function POST(request: Request) {
  const body = await request.text();
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  const runtimeToken = process.env.HIREME_MCP_TOKEN;

  try {
    const response = await fetch(`${runtimeUrl}/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(runtimeToken ? { authorization: `Bearer ${runtimeToken}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const payload = await response.text();
    return new Response(payload, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json(
      {
        detail:
          "HireMe Agent Runtime에 연결할 수 없습니다. hireme_agent 서버가 127.0.0.1:8000에서 실행 중인지 확인해주세요.",
      },
      { status: 503 },
    );
  }
}
