import { supabase } from "@/lib/supabase";
import type { DesignAgent, DesignRequest, SubmittedProject } from "@/types";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]);

export async function submitProject(agent: DesignAgent, request: DesignRequest): Promise<SubmittedProject> {
  if (!supabase) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return { projectId: crypto.randomUUID(), jobId: crypto.randomUUID(), status: "queued" };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("프로젝트를 의뢰하려면 먼저 로그인해 주세요.");
  if (agent.id.startsWith("demo-")) throw new Error("데모 Agent가 아닌 공개 Agent를 선택해 주세요.");
  if (!request.files.length) throw new Error("참고 자료를 한 개 이상 첨부해 주세요.");

  const manifests = await Promise.all(request.files.map(async (file) => {
    if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 50 * 1024 * 1024) {
      throw new Error("PNG, JPG, WEBP, SVG, PDF 파일만 개별 50MB까지 첨부할 수 있어요.");
    }
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return {
      filename: file.name,
      kind: "reference",
      mimeType: file.type,
      sizeBytes: file.size,
      contentDigest: `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    };
  }));

  const hired = await supabase.rpc("hire_demo_agent", { agent_slug: agent.slug });
  if (hired.error) throw hired.error;
  const created = await invoke("create-project", {
    agentId: agent.id,
    idempotencyKey: crypto.randomUUID(),
    brief: {
      objective: `${request.title}\n\n${request.description}\n\n${request.guide}`.trim(),
      audience: request.audience || "확인 필요",
      channel: request.channel || "확인 필요",
      goal: request.category || "디자인 프로젝트",
      deliverables: agent.resultTypes.map((kind) => ({ kind, format: "designer_defined", count: 1 })),
      mustInclude: request.mustInclude.split("\n").filter(Boolean),
      mustAvoid: request.mustAvoid.split("\n").filter(Boolean),
    },
    assets: manifests,
  });

  if (!created.project?.id || created.uploads?.length !== request.files.length) throw new Error("파일 업로드 권한을 준비하지 못했어요.");
  for (const [index, upload] of created.uploads.entries()) {
    const result = await supabase.storage.from("design-project-inputs").uploadToSignedUrl(upload.path, upload.token, request.files[index], { contentType: request.files[index].type });
    if (result.error) throw result.error;
  }
  const finalized = await invoke("finalize-project", { projectId: created.project.id });
  return { projectId: finalized.projectId, jobId: finalized.jobId, status: finalized.status };
}

async function invoke(action: string, body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase가 설정되지 않았어요.");
  const response = await supabase.functions.invoke("creator-worker", { body: { action, ...body } });
  if (response.error) throw response.error;
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}
