/**
 * Electron serializes thrown IPC errors primarily as a message. Preserve the
 * application error code in that message so the renderer can act on a revoked
 * management session without relying on non-portable custom Error fields.
 */
export function stableManagementIpcError(error) {
  const code = typeof error?.code === "string" && /^[a-z0-9_]{1,80}$/.test(error.code)
    ? error.code
    : null;
  if (!code) return error;
  const message = String(error?.message || "Management request failed.")
    .replace(/^\[[a-z0-9_]{1,80}\]\s*/i, "");
  const publicError = new Error(`[${code}] ${message}`);
  publicError.code = code;
  return publicError;
}
