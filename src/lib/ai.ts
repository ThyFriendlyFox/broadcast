import { env, features } from "./env";

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMsg {
  role: ChatRole;
  content: string;
}

/**
 * Low-level chat completion. Routes to OpenAI or Anthropic when configured.
 * Returns null when no provider is available so callers can fall back to a
 * deterministic local generator.
 */
export async function rawChat(
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string | null> {
  const { temperature = 0.7, maxTokens = 1200, json = false } = opts;

  try {
    if (features.aiProvider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.openaiKey}`,
        },
        body: JSON.stringify({
          model: env.openaiModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? null;
    }

    if (features.aiProvider === "anthropic") {
      const system = messages.find((m) => m.role === "system")?.content;
      const rest = messages.filter((m) => m.role !== "system");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.anthropicModel,
          system: json ? `${system ?? ""}\nRespond with valid JSON only.` : system,
          max_tokens: maxTokens,
          temperature,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.content?.[0]?.text ?? null;
    }
  } catch (err) {
    console.error("[ai] provider error, falling back to local:", err);
    return null;
  }

  return null;
}

/** Structured generation with a guaranteed local fallback object. */
export async function aiJson<T>(args: {
  system: string;
  prompt: string;
  fallback: T;
  temperature?: number;
}): Promise<{ data: T; source: "ai" | "local" }> {
  if (!features.ai) return { data: args.fallback, source: "local" };
  const out = await rawChat(
    [
      { role: "system", content: args.system },
      { role: "user", content: args.prompt },
    ],
    { json: true, temperature: args.temperature ?? 0.7 },
  );
  if (!out) return { data: args.fallback, source: "local" };
  try {
    return { data: JSON.parse(out) as T, source: "ai" };
  } catch {
    // attempt to extract JSON object
    const match = out.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { data: JSON.parse(match[0]) as T, source: "ai" };
      } catch {
        /* fall through */
      }
    }
    return { data: args.fallback, source: "local" };
  }
}

/** Free-text generation with a local fallback string. */
export async function aiText(args: {
  system: string;
  messages: ChatMsg[];
  fallback: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; source: "ai" | "local" }> {
  if (!features.ai) return { text: args.fallback, source: "local" };
  const out = await rawChat([{ role: "system", content: args.system }, ...args.messages], {
    temperature: args.temperature,
    maxTokens: args.maxTokens,
  });
  if (!out) return { text: args.fallback, source: "local" };
  return { text: out, source: "ai" };
}
