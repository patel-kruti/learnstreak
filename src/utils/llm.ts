import { captureError } from './sentry';

// ── Lazy native load ──────────────────────────────────────────────────────────
// react-native-executorch requires a dev-client build — it is not available in
// Expo Go. Guard the require() so the module never throws on import and the Add
// screen keeps working in Expo Go without the AI feature.

let _LLMModule: any = null;
let _models: any = null;
try {
  const executorch = require('react-native-executorch');
  _LLMModule = executorch.LLMModule;
  _models    = executorch.models;
  // v0.9+ requires a resource fetcher adapter to be registered before any model load.
  const { ExpoResourceFetcher } = require('react-native-executorch-expo-resource-fetcher');
  executorch.initExecutorch({ resourceFetcher: ExpoResourceFetcher });
} catch {}

const isSupported = !!_LLMModule && !!_models;

// ── Singleton ─────────────────────────────────────────────────────────────────
// Model loads once, survives tab switches, ready for every subsequent call.

let _module: any = null;
let _inflightLoad: Promise<any | null> | null = null;

async function getLLMModule(
  onProgress?: (progress: number) => void
): Promise<any | null> {
  if (!isSupported) return null;
  if (_module) return _module;
  if (_inflightLoad) return _inflightLoad;

  _inflightLoad = _LLMModule.fromModelName(
    _models.llm.qwen2_5_1_5b({ quant: true }),
    onProgress ?? (() => {})
  )
    .then((m: any) => {
      _module = m;
      _inflightLoad = null;
      return m;
    })
    .catch((e: unknown) => {
      _inflightLoad = null;
      captureError(e, { op: 'loadLLM' });
      return null;
    });

  return _inflightLoad;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(
  title: string,
  notes: string,
  categories: { id: string; label: string }[]
): string {
  const list = categories.map((c) => `${c.id} (${c.label})`).join(', ');
  return [
    `You are a learning session tagger. Given a session title and optional notes, respond with ONLY a JSON object — no markdown, no explanation.`,
    ``,
    `JSON fields:`,
    `- "category": best matching id from this list: ${list}`,
    `- "summary": one-line insight or skill practiced, max 80 chars, plain text`,
    ``,
    `The summary must NOT be the title reworded, fixed, or shortened. Infer what skill`,
    `the person likely practiced or learned from the subject matter, even with no notes.`,
    ``,
    `Example:`,
    `Title: "leetcode two sum"`,
    `Notes: (none)`,
    `{"category": "coding", "summary": "Practiced hash-map lookups for array pair problems"}`,
    ``,
    `Title: "${title}"`,
    notes.trim() ? `Notes: "${notes.trim()}"` : `Notes: (none)`,
  ].join('\n');
}

// Normalizes to bare lowercase words so trivial rewording/spelling fixes of
// the title still compare equal to the title itself.
function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// The model sometimes falls back to cleaning up the title instead of
// inventing a real summary — catch that and treat it as no suggestion.
function isTitleEcho(summary: string, title: string): boolean {
  const normSummary = normalizeForComparison(summary);
  const normTitle = normalizeForComparison(title);
  if (!normTitle) return false;
  return normSummary === normTitle || normSummary.includes(normTitle);
}

function parseResponse(
  raw: string,
  validIds: string[],
  title: string
): { category: string; summary: string } | null {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed.category || !parsed.summary) return null;
    const summary = String(parsed.summary).slice(0, 100);
    if (isTitleEcho(summary, title)) return null;
    const category = validIds.includes(String(parsed.category))
      ? String(parsed.category)
      : validIds[0];
    return { category, summary };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EnrichmentSuggestion {
  category: string;
  summary: string;
}

// Returns null silently in Expo Go or if inference fails — the UI degrades
// gracefully and the form still works exactly as before.
export async function suggestEnrichment(
  title: string,
  notes: string,
  categories: { id: string; label: string }[],
  onProgress?: (progress: number) => void
): Promise<EnrichmentSuggestion | null> {
  if (!isSupported) return null;
  if (!title.trim() || title.trim().length < 6) return null;

  try {
    const llm = await getLLMModule(onProgress);
    if (!llm) return null;

    const prompt = buildPrompt(title, notes, categories);
    const raw = await llm.generate([{ role: 'user', content: prompt }]);
    return parseResponse(raw, categories.map((c) => c.id), title);
  } catch (e) {
    captureError(e, { op: 'suggestEnrichment', title });
    return null;
  }
}
