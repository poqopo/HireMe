import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const maxAssetBytes = 50 * 1024 * 1024;
const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]);

export function createDesignProjectService({ getClient, getUser } = {}) {
  async function submitProject({ agentId, brief, attachments } = {}) {
    requireUser(getUser);
    const client = requireClient(getClient);
    const files = [];
    for (const attachment of (Array.isArray(attachments) ? attachments : []).slice(0, 12)) {
      const path = resolve(String(attachment?.path || ""));
      const info = await stat(path);
      if (!info.isFile() || info.size < 1 || info.size > maxAssetBytes) throw new Error("프로젝트 파일은 개별 50MB 이하여야 합니다.");
      const bytes = await readFile(path);
      const mimeType = normalizeMime(attachment?.mimeType, path);
      if (!allowedMime.has(mimeType)) {
        bytes.fill(0);
        throw new Error("PNG, JPG, WEBP, SVG 또는 PDF 파일만 프로젝트에 첨부할 수 있습니다.");
      }
      files.push({
        path,
        bytes,
        manifest: {
          filename: String(attachment?.name || basename(path)).slice(0, 240),
          kind: String(attachment?.kind || "reference").slice(0, 80),
          mimeType,
          sizeBytes: info.size,
          contentDigest: sha256(bytes),
        },
      });
    }
    if (!files.length) throw new Error("브랜드 또는 제품 참고 파일을 하나 이상 첨부해 주세요.");
    let projectId = null;
    try {
      const created = await invoke(client, "create-project", {
        agentId,
        idempotencyKey: randomUUID(),
        brief,
        assets: files.map((file) => file.manifest),
      });
      projectId = created.project?.id;
      if (!projectId || created.uploads?.length !== files.length) throw new Error("프로젝트 업로드 권한을 받지 못했습니다.");
      for (const [index, upload] of created.uploads.entries()) {
        const uploaded = await client.storage.from("design-project-inputs").uploadToSignedUrl(
          upload.path,
          upload.token,
          files[index].bytes,
          { contentType: files[index].manifest.mimeType, upsert: false },
        );
        files[index].bytes.fill(0);
        if (uploaded.error) throw new Error(`프로젝트 파일 업로드 실패: ${uploaded.error.message}`);
      }
      const finalized = await invoke(client, "finalize-project", { projectId });
      return { schema: "hireme.desktop.design_project_submit.v1", ...finalized, project: created.project };
    } catch (error) {
      if (projectId) await invoke(client, "cancel", { projectId }).catch(() => {});
      throw error;
    } finally {
      for (const file of files) file.bytes.fill(0);
    }
  }

  async function listProjects() {
    requireUser(getUser);
    return invoke(requireClient(getClient), "projects", {});
  }

  async function cancelProject({ projectId } = {}) {
    requireUser(getUser);
    return invoke(requireClient(getClient), "cancel", { projectId });
  }

  return { submitProject, listProjects, cancelProject };
}

async function invoke(client, action, body) {
  const response = await client.functions.invoke("creator-worker", { body: { action, ...body } });
  if (response.error) throw new Error(await edgeErrorMessage(response.error));
  if (response.data?.error) throw new Error(String(response.data.error));
  return response.data || {};
}

function requireClient(getClient) {
  const client = getClient?.();
  if (!client) throw new Error("HireMe 로그인 세션을 확인하지 못했습니다.");
  return client;
}

function requireUser(getUser) {
  if (!getUser?.()?.id) throw new Error("HireMe 로그인이 필요합니다.");
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeMime(value, path) {
  const provided = String(value || "").toLowerCase();
  if (provided && provided !== "application/octet-stream") return provided;
  const extension = path.toLowerCase().split(".").at(-1);
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf" })[extension] || "application/octet-stream";
}

async function edgeErrorMessage(error) {
  try {
    const context = error?.context;
    if (context && typeof context.json === "function") {
      const payload = await (typeof context.clone === "function" ? context.clone() : context).json();
      if (payload?.error) return String(payload.error);
    }
  } catch {}
  try {
    const context = error?.context;
    if (context && typeof context.text === "function") {
      const text = await (typeof context.clone === "function" ? context.clone() : context).text();
      if (text.trim()) return text.trim().slice(0, 500);
    }
  } catch {}
  return error?.message || "디자인 프로젝트 요청에 실패했습니다.";
}
