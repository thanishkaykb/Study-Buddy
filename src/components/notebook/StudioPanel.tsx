import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateStudioItem, recordQuizAttempt } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Layers,
  ListChecks,
  HelpCircle,
  GitBranch,
  BookOpen,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { scheduleNext, nextDueAt } from "@/lib/srs";
import { exportFlashcardsPdf, exportMarkdownPdf, exportQuizPdf } from "@/lib/pdf-export";

type Kind = "summary" | "notes" | "flashcards" | "quiz" | "faq" | "mindmap";

type Item = { id: string; kind: Kind; title: string; data: any; created_at: string; notebook_id: string };

const TOOLS: { kind: Kind; label: string; icon: any; desc: string }[] = [
  { kind: "summary", label: "Summary", icon: FileText, desc: "Concise exam-ready" },
  { kind: "notes", label: "Notes", icon: BookOpen, desc: "Full structured notes" },
  { kind: "flashcards", label: "Flashcards", icon: Layers, desc: "Spaced-repetition deck" },
  { kind: "quiz", label: "Quiz / MCQ", icon: ListChecks, desc: "10 MCQs with explanations" },
  { kind: "faq", label: "FAQs", icon: HelpCircle, desc: "Common questions" },
  { kind: "mindmap", label: "Mind Map", icon: GitBranch, desc: "Visual topic overview" },
];

export function StudioPanel({ notebookId, sourcesCount }: { notebookId: string; sourcesCount: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busyKind, setBusyKind] = useState<Kind | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const gen = useServerFn(generateStudioItem);

  async function load() {
    const { data } = await supabase
      .from("studio_items")
      .select("id, kind, title, data, created_at, notebook_id")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false });
    setItems((data as Item[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [notebookId]);

  async function generate(kind: Kind) {
    if (sourcesCount === 0) return toast.error("Add at least one source first.");
    setBusyKind(kind);
    try {
      const item = await gen({ data: { notebookId, kind } });
      setOpen(item as Item);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setBusyKind(null);
    }
  }

  async function remove(id: string) {
    await supabase.from("studio_items").delete().eq("id", id);
    setOpen(null);
    load();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-display text-lg flex items-center gap-2">
          <Sparkles className="size-4 text-brand" /> Studio
        </h2>
        <p className="text-xs text-muted-foreground">AI-generated study assets</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.kind}
              onClick={() => generate(t.kind)}
              disabled={busyKind !== null}
              className="text-left rounded-xl border bg-surface p-3 hover:border-brand hover:shadow-brand transition-all disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                {busyKind === t.kind ? (
                  <Loader2 className="size-4 animate-spin text-brand" />
                ) : (
                  <t.icon className="size-4 text-brand" />
                )}
                <span className="font-medium text-sm">{t.label}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground px-1 mb-1">Saved</div>
            <div className="space-y-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setOpen(it)}
                  className="w-full text-left rounded-lg p-2 hover:bg-surface-muted flex items-center gap-2"
                >
                  <IconFor kind={it.kind} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{it.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(it.created_at).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {open && <StudioViewer item={open} onClose={() => setOpen(null)} onDelete={() => remove(open.id)} />}
    </div>
  );
}

function IconFor({ kind }: { kind: Kind }) {
  const t = TOOLS.find((t) => t.kind === kind)!;
  return <t.icon className="size-4 text-brand shrink-0" />;
}

function StudioViewer({ item, onClose, onDelete }: { item: Item; onClose: () => void; onDelete: () => void }) {
  function exportPdf() {
    try {
      if (item.kind === "summary" || item.kind === "notes" || item.kind === "faq") {
        const md =
          item.kind === "faq"
            ? (item.data.items ?? []).map((x: any) => `## ${x.q}\n${x.a}`).join("\n\n")
            : item.data.markdown ?? "";
        exportMarkdownPdf(item.title, md);
      } else if (item.kind === "flashcards") {
        exportFlashcardsPdf(item.title, item.data.cards ?? []);
      } else if (item.kind === "quiz") {
        exportQuizPdf(item.title, item.data.questions ?? []);
      } else {
        toast.info("PDF export not supported for this type.");
        return;
      }
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <IconFor kind={item.kind} />
          <h2 className="font-display text-2xl truncate">{item.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {item.kind !== "mindmap" && (
            <Button variant="outline" onClick={exportPdf}>
              <Download className="size-4 mr-2" /> PDF
            </Button>
          )}
          <Button variant="ghost" onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4 mr-1" /> Delete
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {item.kind === "summary" || item.kind === "notes" ? (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.data.markdown ?? ""}</ReactMarkdown>
            </div>
          ) : item.kind === "flashcards" ? (
            <Flashcards item={item} />
          ) : item.kind === "quiz" ? (
            <Quiz item={item} />
          ) : item.kind === "faq" ? (
            <FAQ items={item.data.items ?? []} />
          ) : item.kind === "mindmap" ? (
            <MindMap root={item.data.root} branches={item.data.branches ?? []} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- FLASHCARDS WITH SRS ---------------- */
type Card = { front: string; back: string; topic?: string };
type ReviewRow = {
  card_index: number;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  last_grade: number | null;
};

function Flashcards({ item }: { item: Item }) {
  const cards: Card[] = item.data.cards ?? [];
  const [reviews, setReviews] = useState<Record<number, ReviewRow>>({});
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showDueOnly, setShowDueOnly] = useState(true);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("flashcard_reviews")
      .select("card_index, ease, interval_days, repetitions, due_at, last_grade")
      .eq("studio_item_id", item.id);
    const map: Record<number, ReviewRow> = {};
    (data ?? []).forEach((r: any) => (map[r.card_index] = r));
    setReviews(map);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, [item.id]);

  if (cards.length === 0) return <p>No cards generated.</p>;

  const now = Date.now();
  const queue = cards
    .map((_, idx) => idx)
    .filter((idx) => {
      if (!showDueOnly) return true;
      const r = reviews[idx];
      if (!r) return true; // never reviewed = due
      return new Date(r.due_at).getTime() <= now;
    });

  const dueCount = cards.filter((_, idx) => {
    const r = reviews[idx];
    return !r || new Date(r.due_at).getTime() <= now;
  }).length;

  const cardIdx = queue[Math.min(i, queue.length - 1)] ?? 0;
  const card = cards[cardIdx];

  async function grade(g: 0 | 3 | 4 | 5) {
    const r = reviews[cardIdx];
    const prev = r
      ? { ease: r.ease, interval: r.interval_days, repetitions: r.repetitions }
      : { ease: 2.5, interval: 0, repetitions: 0 };
    const next = scheduleNext(prev, g);
    const due_at = nextDueAt(next.dueInDays);
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("flashcard_reviews").upsert(
      {
        user_id: u.user!.id,
        notebook_id: item.notebook_id,
        studio_item_id: item.id,
        card_index: cardIdx,
        ease: next.ease,
        interval_days: next.interval,
        repetitions: next.repetitions,
        due_at,
        last_grade: g,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,studio_item_id,card_index" },
    );
    setFlipped(false);
    setI((x) => x + 1);
    load();
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="size-14 rounded-2xl gradient-brand text-brand-foreground grid place-items-center mx-auto shadow-brand">
          <Calendar className="size-7" />
        </div>
        <h3 className="font-display text-2xl mt-4">All done for now!</h3>
        <p className="text-muted-foreground mt-1">No cards due. Come back later or review all.</p>
        <Button variant="outline" className="mt-4" onClick={() => setShowDueOnly(false)}>
          Review all anyway
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="text-muted-foreground">
          Card {Math.min(i, queue.length - 1) + 1} of {queue.length}
          {card.topic && <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-soft text-accent-foreground text-xs">{card.topic}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {dueCount} / {cards.length} due
          </span>
          <button
            onClick={() => {
              setShowDueOnly((s) => !s);
              setI(0);
              setFlipped(false);
            }}
            className="text-xs text-brand hover:underline"
          >
            {showDueOnly ? "Show all" : "Due only"}
          </button>
        </div>
      </div>
      <div
        onClick={() => setFlipped((f) => !f)}
        className="min-h-[280px] rounded-2xl border-2 bg-surface p-8 grid place-items-center text-center cursor-pointer hover:border-brand transition-colors"
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
            {flipped ? "Answer" : "Question"}
          </div>
          <div className="text-xl">{flipped ? card.back : card.front}</div>
          <div className="text-xs text-muted-foreground mt-6">Click to flip</div>
        </div>
      </div>
      {flipped ? (
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Button variant="outline" className="border-destructive text-destructive" onClick={() => grade(0)}>
            Again
          </Button>
          <Button variant="outline" onClick={() => grade(3)}>
            Hard
          </Button>
          <Button variant="outline" className="border-success text-success" onClick={() => grade(4)}>
            Good
          </Button>
          <Button className="gradient-brand text-brand-foreground" onClick={() => grade(5)}>
            Easy
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setFlipped(false);
              setI((x) => Math.max(0, x - 1));
            }}
            disabled={i === 0}
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFlipped(false);
              setI((x) => Math.min(queue.length - 1, x + 1));
            }}
            disabled={i >= queue.length - 1}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      {!loaded && <div className="text-xs text-muted-foreground mt-2">Loading review schedule…</div>}
    </div>
  );
}

/* ---------------- QUIZ ---------------- */
type QQ = { q: string; options: string[]; answer: number; explanation: string; topic?: string };
function Quiz({ item }: { item: Item }) {
  const questions: QQ[] = item.data.questions ?? [];
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const record = useServerFn(recordQuizAttempt);

  if (questions.length === 0) return <p>No questions generated.</p>;
  const correct = Object.entries(picks).filter(([i, p]) => questions[+i].answer === p).length;

  async function submit() {
    setSubmitted(true);
    try {
      const details = questions.map((q, i) => ({
        topic: q.topic ?? null,
        correct: picks[i] === q.answer,
        picked: picks[i] ?? null,
        answer: q.answer,
      }));
      const topics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean) as string[]));
      await record({
        data: {
          notebookId: item.notebook_id,
          studioItemId: item.id,
          score: correct,
          total: questions.length,
          topics,
          details,
        },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save attempt");
    }
  }

  // topic-level performance for retake suggestion
  const topicScore: Record<string, { c: number; t: number }> = {};
  questions.forEach((q, i) => {
    if (!q.topic) return;
    const cur = topicScore[q.topic] ?? { c: 0, t: 0 };
    cur.t += 1;
    if (picks[i] === q.answer) cur.c += 1;
    topicScore[q.topic] = cur;
  });
  const weakTopics = Object.entries(topicScore)
    .filter(([, v]) => v.c / v.t < 0.7)
    .map(([k]) => k);

  const gen = useServerFn(generateStudioItem);
  async function targeted() {
    try {
      toast.info("Generating targeted quiz…");
      await gen({
        data: { notebookId: item.notebook_id, kind: "quiz", focusTopics: weakTopics },
      });
      toast.success("New targeted quiz added to Studio");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => {
        const userPick = picks[i];
        return (
          <div key={i} className="rounded-xl border bg-surface p-4">
            <div className="font-medium">
              {i + 1}. {q.q}
              {q.topic && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-soft text-accent-foreground">
                  {q.topic}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {q.options.map((opt, j) => {
                const isPicked = userPick === j;
                const isCorrect = q.answer === j;
                let cls = "border-border";
                if (submitted) {
                  if (isCorrect) cls = "border-success bg-success/10";
                  else if (isPicked) cls = "border-destructive bg-destructive/10";
                } else if (isPicked) cls = "border-brand bg-brand-soft";
                return (
                  <button
                    key={j}
                    disabled={submitted}
                    onClick={() => setPicks((p) => ({ ...p, [i]: j }))}
                    className={`w-full text-left p-2.5 rounded-lg border ${cls} text-sm`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + j)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="text-sm text-muted-foreground mt-3 border-t pt-2">
                <span className="font-medium text-foreground">Explanation: </span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
      {!submitted ? (
        <Button onClick={submit} className="gradient-brand text-brand-foreground w-full">
          Submit
        </Button>
      ) : (
        <div className="text-center p-6 rounded-xl border bg-surface space-y-3">
          <div className="font-display text-4xl text-gradient-brand">
            {correct} / {questions.length}
          </div>
          <div className="text-muted-foreground">correct ({Math.round((correct / questions.length) * 100)}%)</div>
          {weakTopics.length > 0 && (
            <Button variant="outline" onClick={targeted}>
              <Sparkles className="size-4 mr-2" /> Practice weak topics: {weakTopics.join(", ")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <details key={i} className="rounded-xl border bg-surface p-4 group">
          <summary className="font-medium cursor-pointer list-none flex items-center justify-between">
            <span>{it.q}</span>
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 text-muted-foreground prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.a}</ReactMarkdown>
          </div>
        </details>
      ))}
    </div>
  );
}

function MindMap({ root, branches }: { root: string; branches: any[] }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-block px-6 py-3 rounded-2xl gradient-brand text-brand-foreground font-display text-2xl shadow-brand">
          {root}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {branches.map((b, i) => (
          <div key={i} className="rounded-xl border bg-surface p-4">
            <div className="font-medium text-brand">{b.label}</div>
            {b.children && (
              <ul className="mt-2 space-y-1 text-sm">
                {b.children.map((c: any, j: number) => (
                  <li key={j}>
                    <div className="flex items-start gap-2">
                      <div className="size-1.5 rounded-full bg-brand mt-2" />
                      <div>
                        <div>{c.label}</div>
                        {c.children && (
                          <ul className="mt-1 ml-3 text-xs text-muted-foreground space-y-0.5">
                            {c.children.map((g: any, k: number) => (
                              <li key={k}>– {g.label}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
