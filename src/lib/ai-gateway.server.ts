const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function callAI(opts: {
  messages: ChatMsg[];
  model?: string;
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages: opts.messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function buildSourcesContext(
  sources: { title: string; content: string }[],
  maxCharsPerSource = 18000,
  maxTotal = 120000,
): string {
  let total = 0;
  const parts: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const trimmed = (s.content ?? "").slice(0, maxCharsPerSource);
    const block = `\n\n=== SOURCE [${i + 1}] "${s.title}" ===\n${trimmed}`;
    if (total + block.length > maxTotal) break;
    parts.push(block);
    total += block.length;
  }
  return parts.join("");
}
