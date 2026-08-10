const errorCodePattern = /^[a-z0-9_]{1,80}$/;

export function createRunTerminationError({ signal, cancelReason } = {}) {
  const reason = String(cancelReason || "").trim();
  if (reason === "management_session_expired") {
    return codedError(
      "management_session_required",
      "관리 세션이 만료되어 실행을 중단했습니다. 관리 모드를 다시 열어 주세요.",
    );
  }
  if (reason) {
    return codedError(
      "run_cancelled",
      reason === "renderer_cancelled"
        ? "사용자가 작업을 중지했습니다."
        : "작업 실행이 중지되었습니다.",
    );
  }
  return codedError(
    "runtime_interrupted",
    `AI 실행 프로세스가 예기치 않게 중단되었습니다${signal ? ` (${signal})` : ""}.`,
  );
}

export function createProcessExitError(message, exitCode) {
  const text = String(message || "HireMe runtime failed.");
  const code = /not logged in|log(?:in|ged in)(?:\s+is)?\s+required|sign(?: |-)?in(?:\s+is)?\s+required|oauth|chatgpt 계정|로그인.*필요/i.test(text)
    ? "provider_connection_required"
    : /(?:image generation|codex).*response exceeded event limit|response exceeded event limit/i.test(text)
      ? "provider_response_limit"
    : /unknown !agent|selected agent is not available|not found/i.test(text)
      ? "agent_unavailable"
      : "runtime_failed";
  const error = codedError(code, text);
  error.exitCode = Number.isInteger(exitCode) ? exitCode : null;
  return error;
}

export function stableRunIpcError(error) {
  const existingCode = readRunErrorCode(error);
  const code = existingCode || "runtime_failed";
  const rawMessage = String(error?.message || "작업 실행을 완료하지 못했습니다.");
  const message = rawMessage.replace(/^\[[a-z0-9_]{1,80}\]\s*/i, "");
  const publicError = codedError(code, message);
  if (error?.runFailure && typeof error.runFailure === "object") {
    publicError.runFailure = error.runFailure;
  }
  return publicError;
}

export function readRunErrorCode(error) {
  const direct = typeof error?.code === "string" ? error.code.trim().toLowerCase() : "";
  if (errorCodePattern.test(direct)) return direct;
  const message = String(error?.message || error || "");
  return message.match(/\[([a-z0-9_]{1,80})\]/i)?.[1]?.toLowerCase() || null;
}

function codedError(code, message) {
  const error = new Error(`[${code}] ${String(message || "Request failed.")}`);
  error.code = code;
  return error;
}
