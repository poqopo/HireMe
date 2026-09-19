type Params = { params: Promise<{ agentId: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const { agentId } = await params;
  const runtimeUrl = process.env.HIREME_AGENT_URL ?? "http://127.0.0.1:8000";
  const runtimeToken = process.env.HIREME_MCP_TOKEN;

  try {
    const response = await fetch(
      `${runtimeUrl.replace(/\/$/, "")}/agents/registry/${encodeURIComponent(agentId)}`,
      {
        method: "DELETE",
        headers: runtimeToken
          ? { authorization: `Bearer ${runtimeToken}` }
          : {},
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
