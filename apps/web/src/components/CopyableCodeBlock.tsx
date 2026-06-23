import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Terminal } from "lucide-react";

type CopyableCodeBlockProps = {
  code: string;
  description?: string;
  label: string;
};

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export function CopyableCodeBlock({
  code,
  description,
  label,
}: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await writeTextToClipboard(code);
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1600);
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#b7d7ff] bg-[#07162d] shadow-[0_16px_42px_rgba(8,27,61,0.16)]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold leading-5 text-white">
            <Terminal className="size-4 text-[#8ec5ff]" />
            <span>{label}</span>
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-white/62">
              {description}
            </p>
          ) : null}
        </div>
        <button
          aria-label={`Copy ${label}`}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec5ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07162d]"
          onClick={() => {
            void handleCopy();
          }}
          type="button"
        >
          {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="m-0 max-h-[360px] min-w-0 max-w-full overflow-x-auto p-4 text-left text-[0.78rem] leading-6 text-[#dbeafe] sm:text-[0.82rem]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
