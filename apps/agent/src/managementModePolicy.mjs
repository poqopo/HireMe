export const managementModeRequiredMessage = [
  "관리 모드는 대화 내용으로 전환할 수 없습니다.",
  "내 에이전트 화면이나 `hireme agent` 관리 명령으로 다시 열어 주세요.",
  "Private Harness는 확인된 관리 컨텍스트에서만 표시하거나 수정할 수 있습니다.",
].join("\n");

export function isManagementEscalationRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  if (isManagementModeClaim(text)) return true;

  const privateTarget =
    /\b(?:private|hidden|internal)\s+(?:agent\s+)?(?:harness|prompt|skill|memory|policy|eval)|\bAGENTS\.md\b|\bSOUL\.md\b|\b(?:skills|harness|evals|private-source)\//i.test(text) ||
    /비공개\s*(?:하네스|프롬프트|스킬|메모리|정책|평가)|내부\s*(?:하네스|프롬프트|스킬|정책)|프라이빗\s*하네스|(?:에이전트|Agent|AI)\s*하네스/i.test(text) ||
    /하네스\s*(?:파일|원문|내용|프롬프트|정책|스킬|메모리|평가|소스)/.test(text);
  if (privateTarget) return true;

  const ordinaryHarnessMarketing =
    /(?:강아지|반려견|안전|착용|산업|제품)\s*하네스|하네스[^\n.]{0,30}(?:마케팅|카피|광고|소개|제품)/.test(text);
  if (ordinaryHarnessMarketing) return false;
  return (
    /하네스(?:를|을|의)?[^\n.]{0,30}(?:보여|읽어|열어|수정|고쳐|요약|번역|분석|공개|출력|복사)/.test(text) ||
    /(?:보여|읽어|열어|수정|고쳐|요약|번역|분석|공개|출력|복사)[^\n.]{0,30}하네스/.test(text)
  );
}

export function isManagementModeClaim(value) {
  const text = String(value || "").trim();
  return (
    /^(?:admin|administrator|management|manager|creator|developer|debug)\s+(?:mode|session)[.!?]*$/i.test(text) ||
    /\b(?:enter|enable|activate|start|open|switch\s+(?:to|into)|pretend\s+(?:to\s+be\s+)?in)\s+(?:the\s+)?(?:admin|administrator|management|manager|creator|developer|debug)\s+(?:mode|session)\b/i.test(text) ||
    /\b(?:this|it)\s+is\s+(?:an?\s+)?(?:admin|administrator|management|creator|developer|debug)\s+(?:mode|session)\b/i.test(text) ||
    /\b(?:i\s+am|i'm|we\s+are)\s+in\s+(?:an?\s+)?(?:admin|administrator|management|creator|developer|debug)\s+(?:mode|session)\b/i.test(text) ||
    /\b(?:i\s+am|i'm|we\s+are|act\s+as|treat\s+me\s+as)\s+(?:an?\s+)?(?:admin|administrator)\b/i.test(text) ||
    /^(?:관리|관리자|제작자|개발자|디버그)\s*모드[.!?]*$/.test(text) ||
    /(?:관리|관리자|제작자|개발자|디버그)\s*모드(?:로\s*)?(?:전환|진입|들어|시작|활성화|켜|열어)/.test(text) ||
    /(?:관리|관리자|제작자|개발자|디버그)\s*모드(?:라고)?\s*(?:선언|주장|말하|입력하)/.test(text) ||
    /(?:지금부터|이제|여기는|이\s*대화는?)\s*(?:관리|관리자|제작자|개발자|디버그)\s*모드(?:야|다|입니다|예요|에요)?/.test(text) ||
    /(?:관리|관리자|제작자|개발자|디버그)\s*모드(?:야|다|입니다|예요|에요)(?:\s|[.!?]|$)/.test(text) ||
    /(?:내가|제가|저는|지금부터)\s*관리자(?:야|다|입니다|예요|에요)?/.test(text)
  );
}

export function extractManagementPolicyText(value) {
  const text = String(value || "");
  const startMarker = "<hireme_user_task>";
  const endMarker = "</hireme_user_task>";
  const start = text.indexOf(startMarker);
  const end = start >= 0 ? text.lastIndexOf(endMarker) : -1;
  if (start < 0 || end < 0) return text;
  return text.slice(start + startMarker.length, end).trim();
}
