/**
 * Wrexlyn — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 *
 * Provider configs for the browser-only chat demo. Only providers confirmed
 * (via a live CORS preflight+request test, not just docs) to send
 * Access-Control-Allow-Origin on their chat-completions endpoint are listed
 * here — the rest would need a backend proxy, which this static page
 * doesn't have. Every provider claim here should be checked with an
 * actual browser request, not just curl — they can behave differently.
 *
 * Note: this only holds for plain fetch() requests exactly as written
 * below. If you ever swap in the official OpenAI JS SDK, its extra
 * `x-stainless-*` headers break Gemini's CORS preflight specifically
 * (not the other providers) — stick to raw fetch for this file.
 *
 * Models are resolved live rather than hardcoded: every provider eventually
 * deprecates a free-tier model (this file has already shipped two dead
 * defaults — Groq's llama-3.3-70b-versatile and Gemini's gemini-2.5-flash —
 * that broke this demo in production before this fix). Each provider's own
 * /models list endpoint is fetched at "Start chatting" time and a currently-
 * live model is picked; the result is cached in localStorage for 24h so a
 * fresh deprecation clears itself out within a day with no redeploy needed,
 * and a lookup failure (bad key, network blip, future CORS regression)
 * falls back to today's known-good hardcoded id instead of breaking outright.
 */
const WREXLYN_SYSTEM_PROMPT =
  "You are Wrexlyn, an AI assistant created by Nishant Prabhakar. This is the browser-only chat demo — you have " +
  "no tools, cannot read/write files, and cannot run commands. If asked to do something that needs real file or " +
  "code execution, say so plainly and explain that those capabilities require the licensed Wrexlyn desktop product " +
  "instead of pretending to do it. When asked who made you, say Nishant Prabhakar. If asked for detail about him: " +
  "he's Senior Vice President at SKEGEN Asset Management (a Bharat Biotech Group platform), with 11+ years in " +
  "private equity across The Rohatyn Group's Asia platform, Premji Invest, and EISAF, USD 2B+ in transactions " +
  "executed, and author of four books (Capital in the Shadows, The Next Frontier, The Sovereign Stack, The " +
  "Compute Shift). Point to nishantprabhakar.pages.dev for more.";

/** Consumes an OpenAI-compatible text/event-stream Response body, calling onDelta per content chunk. */
async function consumeOpenAiSseStream(res, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let acc = "";

  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let json;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    const delta = json.choices?.[0]?.delta ?? {};
    if (typeof delta.content === "string" && delta.content) {
      acc += delta.content;
      onDelta(delta.content);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      processLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.trim()) processLine(buffer);
  return acc;
}

async function openAiCompatibleStream(url, apiKey, model, messages, onDelta) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.4 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text.slice(0, 300)}`);
  }
  await consumeOpenAiSseStream(res, onDelta);
}

// ---------- Live model discovery ----------

const MODEL_CACHE_KEY = "wrexlyn_model_cache_v1";
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readModelCache(providerId) {
  try {
    const cache = JSON.parse(localStorage.getItem(MODEL_CACHE_KEY) || "{}");
    const entry = cache[providerId];
    if (entry && Date.now() - entry.at < MODEL_CACHE_TTL_MS) return entry.model;
  } catch {}
  return null;
}
function writeModelCache(providerId, model) {
  try {
    const cache = JSON.parse(localStorage.getItem(MODEL_CACHE_KEY) || "{}");
    cache[providerId] = { model, at: Date.now() };
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/** Fetches and normalizes a provider's /models list — handles both the OpenAI-shaped {data:[...]}
 *  response and Gemini's {models:[...]} shape, stripping Gemini's "models/" resource-name prefix. */
async function fetchModelIds(url, apiKey) {
  const res = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`Model list request failed: ${res.status}`);
  const data = await res.json();
  const list = data.data || data.models || [];
  return list.map((m) => String(m.id || m.name || "").replace(/^models\//, "")).filter(Boolean);
}

function pickModel(ids, preferred, fallback) {
  for (const p of preferred) {
    const hit = ids.find((id) => id.includes(p));
    if (hit) return hit;
  }
  return ids[0] || fallback;
}

async function resolveModel(providerId, apiKey) {
  const meta = PROVIDER_META[providerId];
  const cached = readModelCache(providerId);
  if (cached) return cached;
  try {
    const model = await meta.discoverModel(apiKey);
    writeModelCache(providerId, model);
    return model;
  } catch {
    return meta.fallbackModel;
  }
}

const PROVIDER_META = {
  // Default (first = pre-selected in the dropdown).
  groq: {
    label: "Groq",
    fallbackModel: "openai/gpt-oss-120b",
    needsKey: true,
    note: 'Free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>.',
    discoverModel: async (apiKey) => {
      const ids = (await fetchModelIds("https://api.groq.com/openai/v1/models", apiKey)).filter(
        (id) => !/whisper|guard|moderation|tts/i.test(id)
      );
      return pickModel(ids, ["gpt-oss-120b", "gpt-oss", "qwen3", "llama-3.1", "llama"], "openai/gpt-oss-120b");
    },
    stream: (messages, apiKey, model, onDelta) =>
      openAiCompatibleStream("https://api.groq.com/openai/v1/chat/completions", apiKey, model, messages, onDelta),
  },
  openrouter: {
    label: "OpenRouter",
    fallbackModel: "openai/gpt-oss-20b:free",
    needsKey: true,
    note: 'Free key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a> — pick a ":free" model to avoid needing credits.',
    discoverModel: async () => {
      const ids = (await fetchModelIds("https://openrouter.ai/api/v1/models", "")).filter((id) => id.endsWith(":free"));
      return pickModel(ids, ["gpt-oss", "llama", "qwen"], "openai/gpt-oss-20b:free");
    },
    stream: (messages, apiKey, model, onDelta) =>
      openAiCompatibleStream("https://openrouter.ai/api/v1/chat/completions", apiKey, model, messages, onDelta),
  },
  gemini: {
    label: "Google Gemini",
    fallbackModel: "gemini-3.6-flash",
    needsKey: true,
    note: 'Free key (no credit card) at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.',
    discoverModel: async (apiKey) => {
      const ids = await fetchModelIds(`https://generativelanguage.googleapis.com/v1beta/openai/models`, apiKey);
      return pickModel(ids, ["gemini-3.6-flash", "gemini-3-flash", "gemini-flash", "flash"], "gemini-3.6-flash");
    },
    stream: (messages, apiKey, model, onDelta) =>
      openAiCompatibleStream(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey,
        model,
        messages,
        onDelta
      ),
  },
  cerebras: {
    label: "Cerebras",
    fallbackModel: "llama-3.3-70b",
    needsKey: true,
    note: 'Free key (no credit card) at <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener">cloud.cerebras.ai</a>.',
    discoverModel: async (apiKey) => {
      const ids = await fetchModelIds("https://api.cerebras.ai/v1/models", apiKey);
      return pickModel(ids, ["llama-3.3-70b", "llama-3.1-70b", "llama"], "llama-3.3-70b");
    },
    stream: (messages, apiKey, model, onDelta) =>
      openAiCompatibleStream("https://api.cerebras.ai/v1/chat/completions", apiKey, model, messages, onDelta),
  },
  mistral: {
    label: "Mistral",
    fallbackModel: "mistral-small-latest",
    needsKey: true,
    note: 'Free key at <a href="https://console.mistral.ai" target="_blank" rel="noopener">console.mistral.ai</a> (phone verification required).',
    discoverModel: async (apiKey) => {
      const ids = await fetchModelIds("https://api.mistral.ai/v1/models", apiKey);
      return pickModel(ids, ["mistral-small-latest", "small-latest", "mistral-small"], "mistral-small-latest");
    },
    stream: (messages, apiKey, model, onDelta) =>
      openAiCompatibleStream("https://api.mistral.ai/v1/chat/completions", apiKey, model, messages, onDelta),
  },
};

