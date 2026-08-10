export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function boundedText(value: unknown, name: string, max: number) {
  const text = String(value || "").trim();
  if (!text || text.length > max) throw new Error(`${name} is invalid`);
  return text;
}

export function requireUuid(value: unknown, name: string) {
  const text = String(value || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(text)) {
    throw new Error(`${name} is invalid`);
  }
  return text;
}

export function requireDigest(value: unknown, name = "digest") {
  const text = String(value || "").trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(text)) throw new Error(`${name} is invalid`);
  return text;
}

export function bytesFromBase64(value: unknown) {
  const encoded = String(value || "").trim();
  if (!encoded || encoded.length > 16_384) throw new Error("encoded key is invalid");
  try {
    return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("encoded key is invalid");
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
