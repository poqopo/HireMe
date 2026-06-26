import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCcw,
  Search,
  ServerCog,
} from "lucide-react";
import { CopyableCodeBlock } from "@/components/CopyableCodeBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type JsonRecord = Record<string, unknown>;
type LookupMode = "trace" | "reconcile" | "both";

const gatewayUrl = (
  import.meta.env.VITE_HIREME_GATEWAY_URL || "http://localhost:8787"
).replace(/\/$/, "");
const gatewayApiKey = import.meta.env.VITE_HIREME_GATEWAY_API_KEY || "";

function gatewayRequestHeaders() {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (gatewayApiKey) {
    headers.authorization = `Bearer ${gatewayApiKey}`;
    headers["x-hireme-gateway-key"] = gatewayApiKey;
  }
  return headers;
}

export function DebugCallPage() {
  const [lookupValue, setLookupValue] = useState("");
  const [mode, setMode] = useState<LookupMode>("both");
  const [traceResult, setTraceResult] = useState<JsonRecord | null>(null);
  const [reconcileResult, setReconcileResult] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LookupMode | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialLookup =
      params.get("memory_job_id") ||
      params.get("memoryJobId") ||
      params.get("call_id") ||
      params.get("callId") ||
      params.get("trace_id") ||
      params.get("traceId") ||
      "";
    if (!initialLookup) return;
    setLookupValue(initialLookup);
    void runLookup("both", initialLookup);
  }, []);

  const lookupPayload = useMemo(
    () => buildLookupPayload(lookupValue),
    [lookupValue],
  );
  const trace = readTrace(traceResult);
  const stageRows = readStageRows(trace);
  const eventRows = readEventRows(trace).slice(-12).reverse();
  const reconciliation = asRecord(reconcileResult?.reconciled);
  const sourceSummary = summarizeSources(reconcileResult);

  async function runLookup(nextMode = mode, value = lookupValue) {
    const payload = buildLookupPayload(value);
    if (!Object.keys(payload).length) {
      setError("Enter a call_id, trace_id, or memory_job_id.");
      return;
    }

    setMode(nextMode);
    setLoading(nextMode);
    setError(null);
    try {
      if (nextMode === "trace" || nextMode === "both") {
        const nextTrace = await postGateway("/v1/agent-call/trace", payload);
        setTraceResult(nextTrace);
      }
      if (nextMode === "reconcile" || nextMode === "both") {
        const nextReconcile = await postGateway("/v1/memwal/reconcile", payload);
        setReconcileResult(nextReconcile);
        if (nextMode === "reconcile") {
          setTraceResult(asRecord(nextReconcile.trace) || traceResult);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runLookup(mode);
  }

  return (
    <main className="min-h-screen bg-[#f7faff]">
      <div className="mx-auto grid page-shell gap-6 px-4 py-8 md:px-8">
        <section className="rounded-lg border border-[#dbeafe] bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,52,96,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ServerCog className="size-4" />
                Gateway debug
              </div>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-[#191f28] md:text-3xl">
                Agent call trace
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526173]">
                {gatewayUrl}
              </p>
            </div>
            <Badge
              className="w-fit border-[#bfdbfe] bg-[#eef5ff] text-[#1d4ed8]"
              variant="outline"
            >
              /debug/call
            </Badge>
          </div>

          <form
            className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleSubmit}
          >
            <label className="min-w-0">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
                Lookup id
              </span>
              <Input
                className="rounded-lg"
                onChange={(event) => setLookupValue(event.target.value)}
                placeholder="call_..., trace id, or memory_job_..."
                value={lookupValue}
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <Button
                className="h-11 rounded-lg px-4"
                disabled={loading !== null}
                onClick={() => void runLookup("trace")}
                type="button"
                variant="secondary"
              >
                {loading === "trace" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Trace
              </Button>
              <Button
                className="h-11 rounded-lg px-4"
                disabled={loading !== null}
                onClick={() => void runLookup("reconcile")}
                type="button"
                variant="secondary"
              >
                {loading === "reconcile" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
                Reconcile
              </Button>
              <Button
                className="h-11 rounded-lg px-5"
                disabled={loading !== null}
                type="submit"
              >
                {loading === "both" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Run both
              </Button>
            </div>
          </form>

          {Object.keys(lookupPayload).length ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#526173]">
              {Object.entries(lookupPayload).map(([key, value]) => (
                <span
                  className="rounded-md border border-[#dbeafe] bg-[#f8fbff] px-2 py-1 font-mono"
                  key={key}
                >
                  {key}: {formatShortValue(value)}
                </span>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-sm leading-6 text-[#991b1b]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DebugMetric label="Call" value={asString(trace?.callId)} />
          <DebugMetric label="Trace" value={asString(trace?.traceId)} />
          <DebugMetric label="Memory job" value={asString(trace?.memoryJobId)} />
          <DebugMetric
            label="Status"
            tone={statusTone(asString(trace?.status))}
            value={asString(trace?.status)}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="min-w-0 rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#191f28]">Stages</h2>
              <Badge variant="outline">{stageRows.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.08em] text-[#6b7684]">
                    <th className="border-b border-[#e5eefb] px-3 py-2">Stage</th>
                    <th className="border-b border-[#e5eefb] px-3 py-2">Status</th>
                    <th className="border-b border-[#e5eefb] px-3 py-2">Updated</th>
                    <th className="border-b border-[#e5eefb] px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.length ? (
                    stageRows.map((stage) => (
                      <tr className="align-top" key={stage.name}>
                        <td className="border-b border-[#eef4fd] px-3 py-3 font-mono text-xs text-[#273951]">
                          {stage.name}
                        </td>
                        <td className="border-b border-[#eef4fd] px-3 py-3">
                          <StatusPill status={stage.status} />
                        </td>
                        <td className="border-b border-[#eef4fd] px-3 py-3 text-xs text-[#526173]">
                          {formatDateTime(stage.updatedAt)}
                        </td>
                        <td className="max-w-[360px] border-b border-[#eef4fd] px-3 py-3 text-xs leading-5 text-[#526173]">
                          {stage.details}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-8 text-center text-sm text-[#6b7684]"
                        colSpan={4}
                      >
                        No trace loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid min-w-0 gap-4">
            <div className="rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[#191f28]">
                  Reconcile
                </h2>
                <StatusPill status={asString(reconcileResult?.status)} />
              </div>
              <div className="grid gap-2 text-sm">
                <DebugBoolean
                  label="User MemWal"
                  value={asBoolean(reconciliation?.userMemWalStored)}
                />
                <DebugBoolean
                  label="Ledger"
                  value={asBoolean(reconciliation?.ledgerStored)}
                />
                <DebugBoolean
                  label="Conversation"
                  value={asBoolean(reconciliation?.conversationStored)}
                />
                <DebugBoolean
                  label="Complete"
                  value={asBoolean(reconciliation?.complete)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
              <h2 className="text-base font-semibold text-[#191f28]">Sources</h2>
              <div className="mt-3 grid gap-2">
                {sourceSummary.map((source) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-[#eef4fd] bg-[#fbfdff] px-3 py-2"
                    key={source.label}
                  >
                    <span className="text-sm font-medium text-[#273951]">
                      {source.label}
                    </span>
                    <StatusPill status={source.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#191f28]">Recent events</h2>
            <Badge variant="outline">{eventRows.length}</Badge>
          </div>
          <div className="grid gap-2">
            {eventRows.length ? (
              eventRows.map((event, index) => (
                <div
                  className="grid gap-2 rounded-md border border-[#eef4fd] bg-[#fbfdff] px-3 py-2 text-sm md:grid-cols-[160px_180px_minmax(0,1fr)]"
                  key={`${event.ts}-${event.stage}-${index}`}
                >
                  <span className="font-mono text-xs text-[#526173]">
                    {formatDateTime(event.ts)}
                  </span>
                  <span className="font-mono text-xs text-[#273951]">
                    {event.stage}
                  </span>
                  <span className="min-w-0 truncate text-[#526173]">
                    {event.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#dbeafe] px-3 py-8 text-center text-sm text-[#6b7684]">
                No events loaded.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <CopyableCodeBlock
            code={formatJson(traceResult)}
            description="/v1/agent-call/trace"
            label="Trace JSON"
          />
          <CopyableCodeBlock
            code={formatJson(reconcileResult)}
            description="/v1/memwal/reconcile"
            label="Reconcile JSON"
          />
        </section>
      </div>
    </main>
  );
}

function DebugMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  value: string | null;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#dbeafe] bg-white p-4 shadow-[0_12px_28px_rgba(15,52,96,0.05)]">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7684]">
        {label}
      </div>
      <div
        className={[
          "mt-2 min-h-6 truncate font-mono text-sm font-semibold",
          tone === "good"
            ? "text-[#047857]"
            : tone === "warn"
              ? "text-[#b45309]"
              : tone === "bad"
                ? "text-[#b91c1c]"
                : "text-[#273951]",
        ].join(" ")}
        title={value || ""}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function DebugBoolean({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#eef4fd] bg-[#fbfdff] px-3 py-2">
      <span className="font-medium text-[#273951]">{label}</span>
      <StatusPill status={value === null ? null : value ? "stored" : "missing"} />
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const tone = statusTone(status);
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "good"
          ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#047857]"
          : tone === "warn"
            ? "border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
            : tone === "bad"
              ? "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
              : "border-[#dbeafe] bg-[#f8fbff] text-[#526173]",
      ].join(" ")}
    >
      {status || "unknown"}
    </span>
  );
}

async function postGateway(endpoint: string, payload: JsonRecord) {
  const response = await fetch(`${gatewayUrl}${endpoint}`, {
    body: JSON.stringify(payload),
    headers: gatewayRequestHeaders(),
    method: "POST",
  });
  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    const message =
      asString(asRecord(data)?.message) ||
      asString(asRecord(data)?.error) ||
      `Gateway ${response.status}`;
    throw new Error(message);
  }
  return asRecord(data) || {};
}

function buildLookupPayload(value: string): JsonRecord {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("memory_job_")) return { memory_job_id: trimmed };
  if (trimmed.startsWith("call_")) return { call_id: trimmed };
  return { trace_id: trimmed };
}

function readTrace(payload: JsonRecord | null) {
  if (!payload) return null;
  return asRecord(payload.trace) || payload;
}

function readStageRows(trace: JsonRecord | null) {
  const stages = asRecord(trace?.stages);
  if (!stages) return [];
  return Object.entries(stages).map(([name, raw]) => {
    const stage = asRecord(raw) || {};
    const details = Object.entries(stage)
      .filter(([key]) => !["status", "updatedAt"].includes(key))
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${formatShortValue(value)}`)
      .join(" · ");
    return {
      name,
      status: asString(stage.status),
      updatedAt: asString(stage.updatedAt),
      details: details || "-",
    };
  });
}

function readEventRows(trace: JsonRecord | null) {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  return events
    .map((raw) => asRecord(raw))
    .filter((event): event is JsonRecord => Boolean(event))
    .map((event) => ({
      ts: asString(event.ts),
      stage: asString(event.stage) || "-",
      status: asString(event.status) || "-",
    }));
}

function summarizeSources(reconcileResult: JsonRecord | null) {
  const sources = asRecord(reconcileResult?.sources);
  const supabase = asRecord(sources?.supabase);
  return [
    {
      label: "Memory job",
      status: sources?.memoryJob ? "found" : "missing",
    },
    {
      label: "Local MemWal",
      status: asRecord(sources?.localMemWal)?.exists ? "found" : "missing",
    },
    {
      label: "Local ledger",
      status: sources?.localLedger ? "found" : "missing",
    },
    {
      label: "Supabase ledger",
      status: supabase?.ledger ? "found" : "missing",
    },
    {
      label: "Supabase MemWal",
      status: supabase?.userMemWalResult ? "found" : "missing",
    },
  ];
}

function statusTone(status: string | null): "neutral" | "good" | "warn" | "bad" {
  const normalized = String(status || "").toLowerCase();
  if (
    ["completed", "stored", "recorded", "reconciled", "found", "ready"].includes(
      normalized,
    )
  ) {
    return "good";
  }
  if (["pending", "running", "waiting", "skipped", "missing"].includes(normalized)) {
    return "warn";
  }
  if (["failed", "error", "incomplete"].includes(normalized)) return "bad";
  return "neutral";
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function formatJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

function formatShortValue(value: unknown) {
  if (typeof value === "string") return value.length > 52 ? `${value.slice(0, 52)}...` : value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value).slice(0, 72);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
