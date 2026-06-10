import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, buildSourcesContext } from "./ai-gateway.server";

async function getNotebookSources(supabase: any, notebookId: string, userId: string) {
  const { data, error } = await supabase
    .from("sources")
    .select("id, title, content")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; title: string; content: string }[];
}

/* -------------------- CHAT -------------------- */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      notebookId: z.string().uuid(),
      message: z.string().min(1).max(8000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", data.notebookId)
      .eq("user_id", userId)
      .maybeSingle();
    if (nbErr || !nb) throw new Error("Notebook not found");

    const sources = await getNotebookSources(supabase, data.notebookId, userId);
    const ctx = buildSourcesContext(sources);

    await supabase.from("chat_messages").insert({
      notebook_id: data.notebookId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("notebook_id", data.notebookId)
      .order("created_at", { ascending: true })
      .limit(20);

    const systemPrompt = `You are StudyMind AI, an expert tutor that answers ONLY using the user's uploaded study sources.

RULES:
- Base every answer strictly on the provided SOURCES below. If something isn't in the sources, say so clearly.
- Always cite sources inline using the format [1], [2] referring to the SOURCE numbers. Multiple citations allowed: [1][3].
- Adapt response length and structure to the user's intent:
  * MCQs / multiple choice / quiz → numbered list of high-quality MCQs (A/B/C/D), then "Answers" section with brief explanations.
  * "11 mark" / "long answer" / "essay" / "explain in detail" / "3 page" → deeply structured long-form answer (intro, multiple headed sections, examples, conclusion). Aim for ~1500-2500 words. Use markdown headings, bullets, tables.
  * "3 mark" / "short answer" / "in points" / "brief" → 3-6 crisp bullet points.
  * "flashcards" → markdown table of Q/A.
  * Otherwise: clear, well-organized markdown explanation.
- Always use markdown: headings, bullets, bold key terms, tables, short examples.
- Never invent facts. If sources are empty, tell the user to upload material first.

SOURCES:
${ctx || "(no sources uploaded yet)"}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const reply = await callAI({ messages, temperature: 0.4 });

    const cited = new Set<number>();
    const re = /\[(\d+)\]/g;
    let m;
    while ((m = re.exec(reply)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= sources.length) cited.add(n);
    }
    const citations = Array.from(cited).map((n) => ({
      n,
      source_id: sources[n - 1].id,
      title: sources[n - 1].title,
    }));

    const { data: saved } = await supabase
      .from("chat_messages")
      .insert({
        notebook_id: data.notebookId,
        user_id: userId,
        role: "assistant",
        content: reply,
        citations,
      })
      .select()
      .single();

    return { message: saved };
  });

/* -------------------- STUDIO GENERATORS -------------------- */
const StudioKind = z.enum(["summary", "notes", "flashcards", "quiz", "faq", "mindmap"]);

export const generateStudioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      notebookId: z.string().uuid(),
      kind: StudioKind,
      focusTopics: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nb } = await supabase
      .from("notebooks")
      .select("id, title")
      .eq("id", data.notebookId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!nb) throw new Error("Notebook not found");

    const sources = await getNotebookSources(supabase, data.notebookId, userId);
    if (sources.length === 0) throw new Error("Upload at least one source first.");
    const ctx = buildSourcesContext(sources);

    const focus = data.focusTopics?.length
      ? `\n\nFOCUS specifically on these weak topics the student needs practice with: ${data.focusTopics.join(", ")}.`
      : "";

    let title = "";
    let payload: any = {};

    if (data.kind === "summary") {
      const reply = await callAI({
        messages: [
          {
            role: "system",
            content:
              "You produce concise, exam-ready study summaries in markdown. Use headings, bullets, bold key terms. Cite sources inline as [1][2].",
          },
          { role: "user", content: `Summarize all sources for the notebook "${nb.title}".${focus}\n\n${ctx}` },
        ],
        temperature: 0.3,
      });
      title = "Summary";
      payload = { markdown: reply };
    } else if (data.kind === "notes") {
      const reply = await callAI({
        messages: [
          {
            role: "system",
            content:
              "You generate beautifully structured study notes in markdown. Use H2/H3 sections, bullets, tables, bold key terms. Cover ALL major topics. Cite sources as [1][2] inline.",
          },
          { role: "user", content: `Create structured study notes for "${nb.title}".${focus}\n\n${ctx}` },
        ],
        temperature: 0.3,
      });
      title = "Structured Notes";
      payload = { markdown: reply };
    } else if (data.kind === "flashcards") {
      const reply = await callAI({
        json: true,
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"cards":[{"front":"question","back":"answer","topic":"topic name"}, ...]}. Generate 15-25 high-quality flashcards covering the most important concepts. Keep answers precise (1-3 sentences). Each card MUST include a short "topic" tag (1-3 words).',
          },
          { role: "user", content: `Make flashcards from these sources:${focus}\n${ctx}` },
        ],
        temperature: 0.4,
      });
      title = "Flashcards";
      try {
        payload = JSON.parse(reply);
      } catch {
        payload = { cards: [] };
      }
    } else if (data.kind === "quiz") {
      const reply = await callAI({
        json: true,
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","topic":"short topic tag"}]}. Generate 10 high-quality MCQs covering different topics. "answer" is 0-based index. Each question MUST include a "topic" tag (1-3 words).',
          },
          { role: "user", content: `Create an MCQ quiz from:${focus}\n${ctx}` },
        ],
        temperature: 0.5,
      });
      title = data.focusTopics?.length ? `Targeted Quiz: ${data.focusTopics.join(", ")}` : "Practice Quiz";
      try {
        payload = JSON.parse(reply);
      } catch {
        payload = { questions: [] };
      }
    } else if (data.kind === "faq") {
      const reply = await callAI({
        json: true,
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"items":[{"q":"...","a":"..."}]}. Generate 10-15 frequently-asked questions a student would have, with clear answers grounded only in the sources.',
          },
          { role: "user", content: `Generate FAQs from:\n${ctx}` },
        ],
        temperature: 0.4,
      });
      title = "FAQs";
      try {
        payload = JSON.parse(reply);
      } catch {
        payload = { items: [] };
      }
    } else if (data.kind === "mindmap") {
      const reply = await callAI({
        json: true,
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"root":"Central topic","branches":[{"label":"Branch","children":[{"label":"sub"},{"label":"sub","children":[{"label":"leaf"}]}]}]}. 4-7 main branches, 2-5 children each. Concise labels (max 6 words).',
          },
          { role: "user", content: `Build a mind map for "${nb.title}" from:\n${ctx}` },
        ],
        temperature: 0.4,
      });
      title = "Mind Map";
      try {
        payload = JSON.parse(reply);
      } catch {
        payload = { root: nb.title, branches: [] };
      }
    }

    const { data: saved, error } = await supabase
      .from("studio_items")
      .insert({
        notebook_id: data.notebookId,
        user_id: userId,
        kind: data.kind,
        title,
        data: payload,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });

/* -------------------- QUIZ ATTEMPTS -------------------- */
export const recordQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      notebookId: z.string().uuid(),
      studioItemId: z.string().uuid().optional(),
      score: z.number().int().min(0),
      total: z.number().int().min(1),
      topics: z.array(z.string()).default([]),
      details: z.array(z.any()).default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("quiz_attempts").insert({
      user_id: userId,
      notebook_id: data.notebookId,
      studio_item_id: data.studioItemId,
      score: data.score,
      total: data.total,
      topics: data.topics,
      details: data.details,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- URL INGEST (Readability-style extraction) -------------------- */
function extractReadableText(html: string): { title: string; text: string; paywallLikely: boolean } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = (ogTitle?.[1] || titleMatch?.[1] || h1?.[1] || "Untitled")
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 200);

  // Strip noisy regions
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // Prefer <article> or main if present
  const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = cleaned.match(/<main[\s\S]*?<\/main>/i);
  const region = articleMatch?.[0] ?? mainMatch?.[0] ?? cleaned;

  // Pull paragraphs to keep coherent text
  const paragraphs: string[] = [];
  const pRe = /<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = pRe.exec(region)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (t.length > 20) paragraphs.push(t);
  }
  let text = paragraphs.join("\n\n");
  if (text.length < 500) {
    // fallback: dump all text
    text = region.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  text = text.slice(0, 100000);

  const paywallLikely = /paywall|subscribe to read|subscribers only|sign in to continue|metered/i.test(html) && text.length < 1500;
  return { title, text, paywallLikely };
}

export const ingestUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      notebookId: z.string().uuid(),
      url: z.string().url(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; StudyMindBot/1.0; +https://studymind.ai)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(`Failed to fetch URL: ${e.message}`);
    }

    const { title, text, paywallLikely } = extractReadableText(html);

    if (text.length < 200) {
      throw new Error(
        paywallLikely
          ? "This page appears to be behind a paywall or requires login. Try copying the article text into a Text source instead."
          : "Could not extract readable content. Try a Text source or a different URL.",
      );
    }

    const noticed = paywallLikely
      ? "\n\n[Note: this page may be partially paywalled — extracted content may be incomplete.]"
      : "";

    const { data: saved, error } = await supabase
      .from("sources")
      .insert({
        notebook_id: data.notebookId,
        user_id: userId,
        title,
        source_type: "url",
        url: data.url,
        content: text + noticed,
        char_count: text.length,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });
