export async function POST(request: Request) {
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  const runtimeToken = process.env.HIREME_MCP_TOKEN;
  const body = await request.text();

  try {
    const response = await fetch(
      `${runtimeUrl.replace(/\/$/, "")}/agents/register`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(runtimeToken ? { authorization: `Bearer ${runtimeToken}` } : {}),
        },
        body,
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json(
      { detail: "HireMe Agent Runtime에 연결할 수 없습니다." },
      { status: 503 },
    );
  }
}

export async function GET() {
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  const runtimeToken = process.env.HIREME_MCP_TOKEN;
  try {
    const response = await fetch(`${runtimeUrl.replace(/\/$/, "")}/agents`, {
      headers: runtimeToken ? { authorization: `Bearer ${runtimeToken}` } : {},
      cache: "no-store",
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ agents: [] });
  }
}
