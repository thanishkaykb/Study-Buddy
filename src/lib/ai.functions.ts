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

    // Ownership check
    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", data.notebookId)
      .eq("user_id", userId)
      .maybeSingle();
    if (nbErr || !nb) throw new Error("Notebook not found");

    const sources = await getNotebookSources(supabase, data.notebookId, userId);
    const ctx = buildSourcesContext(sources);

    // Save user message first
    await supabase.from("chat_messages").insert({
      notebook_id: data.notebookId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // Pull recent chat history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("notebook_id", data.notebookId)
      .order("created_at", { ascending: true })
      .limit(20);

    const systemPrompt = `You are StudyMind AI, an expert tutor that answers ONLY using the user's uploaded study sources.

RULES:
- Base every answer strictly on the provided SOURCES below. If something isn't in the sources, say so clearly and offer the closest related material.
- Always cite sources inline using the format [1], [2] referring to the SOURCE numbers. Multiple citations allowed: [1][3].
- Adapt response length and structure to the user's intent:
  * If the user asks for "MCQs", "multiple choice", or a quiz → return a numbered list of high-quality MCQs (A/B/C/D), then an "Answers" section with brief explanations.
  * If the user asks for an "11 mark", "long answer", "essay", "explain in detail", or "3 page" answer → produce a deeply structured long-form answer (intro, multiple headed sections with subpoints, examples, diagrams described in text, conclusion). Aim for ~1500-2500 words. Use markdown headings, bullet points, and tables where useful.
  * If the user asks for a "3 mark", "short answer", "in points", or "brief" → return 3-6 crisp bullet points.
  * If the user asks for "flashcards" → return a markdown table of Q/A.
  * Otherwise, give a clear, well-organized explanation in markdown with the appropriate depth.
- Use markdown formatting always: headings, bullet lists, bold key terms, tables, and short examples.
- Never invent facts. If sources are empty, tell the user to upload material first.

SOURCES:
${ctx || "(no sources uploaded yet)"}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const reply = await callAI({ messages, temperature: 0.4 });

    // Extract citations (which source numbers were referenced)
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
  .inputValidator(z.object({ notebookId: z.string().uuid(), kind: StudioKind }))
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

    let title = "";
    let payload: any = {};

    if (data.kind === "summary") {
      const reply = await callAI({
        messages: [
          {
            role: "system",
            content:
              "You produce concise, exam-ready study summaries in markdown. Use headings, bullet points, bold key terms. Cite sources inline as [1][2] referencing the source numbers given.",
          },
          { role: "user", content: `Summarize all sources for the notebook "${nb.title}".\n\n${ctx}` },
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
              "You generate beautifully structured study notes in markdown. Use H2/H3 sections, bullet points, tables for comparisons, and bold for key terms. Cover ALL major topics in the sources. Cite sources as [1][2] inline.",
          },
          { role: "user", content: `Create structured study notes for "${nb.title}".\n\n${ctx}` },
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
              'Return JSON only: {"cards":[{"front":"question","back":"answer"}, ...]}. Generate 15-25 high-quality flashcards covering the most important concepts. Keep answers precise (1-3 sentences).',
          },
          { role: "user", content: `Make flashcards from these sources:\n${ctx}` },
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
              'Return JSON only: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}. Generate 10 high-quality MCQs covering different topics. The "answer" is the 0-based index of the correct option.',
          },
          { role: "user", content: `Create an MCQ quiz from:\n${ctx}` },
        ],
        temperature: 0.5,
      });
      title = "Practice Quiz";
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
              'Return JSON only: {"items":[{"q":"...","a":"..."}]}. Generate 10-15 frequently-asked questions a student would have about this material, with clear answers grounded only in the sources.',
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
              'Return JSON only: {"root":"Central topic","branches":[{"label":"Branch","children":[{"label":"sub"},{"label":"sub","children":[{"label":"leaf"}]}]}]}. 4-7 main branches, 2-5 children each, optional grandchildren. Use concise labels (max 6 words).',
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

/* -------------------- URL INGEST -------------------- */
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
    const res = await fetch(data.url, {
      headers: { "User-Agent": "Mozilla/5.0 StudyMindBot" },
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
    const html = await res.text();
    // Crude HTML → text
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60000);

    const { data: saved, error } = await supabase
      .from("sources")
      .insert({
        notebook_id: data.notebookId,
        user_id: userId,
        title: titleMatch?.[1]?.trim().slice(0, 200) ?? data.url,
        source_type: "url",
        url: data.url,
        content: text,
        char_count: text.length,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return saved;
  });
