import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Return the one document that is allowed to issue privileged desktop IPC.
 * A packaged app never trusts a development-server override.
 */
export function expectedRendererDocumentUrl({
  isPackaged,
  devServerUrl,
  rendererFilePath,
} = {}) {
  if (!isPackaged && String(devServerUrl || "").trim()) {
    const url = new URL(String(devServerUrl).trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("HIREME_DEV_SERVER_URL must use http or https.");
    }
    if (url.username || url.password) {
      throw new Error("HIREME_DEV_SERVER_URL must not include credentials.");
    }
    return url.href;
  }

  if (!rendererFilePath) throw new Error("The packaged renderer path is required.");
  return pathToFileURL(resolve(rendererFilePath)).href;
}

/**
 * Development URLs are compared in their canonical URL form. Packaged builds
 * compare the file URL byte-for-byte so a different local file cannot inherit
 * desktop privileges.
 */
export function isTrustedRendererDocument({
  currentUrl,
  isPackaged,
  devServerUrl,
  rendererFilePath,
} = {}) {
  const expected = expectedRendererDocumentUrl({
    isPackaged,
    devServerUrl,
    rendererFilePath,
  });
  const actual = String(currentUrl || "");
  if (isPackaged || !String(devServerUrl || "").trim()) return actual === expected;
  try {
    return new URL(actual).href === expected;
  } catch {
    return false;
  }
}

export function isTrustedRendererContext({
  senderId,
  trustedWebContentsId,
  senderUrl,
  isMainFrame = true,
  isPackaged,
  devServerUrl,
  rendererFilePath,
} = {}) {
  return Number.isInteger(senderId)
    && Number.isInteger(trustedWebContentsId)
    && senderId === trustedWebContentsId
    && isMainFrame === true
    && isTrustedRendererDocument({
      currentUrl: senderUrl,
      isPackaged,
      devServerUrl,
      rendererFilePath,
    });
}
