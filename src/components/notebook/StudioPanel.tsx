import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateStudioItem } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { FileText, Layers, ListChecks, HelpCircle, GitBranch, BookOpen, Loader2, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

type Kind = "summary" | "notes" | "flashcards" | "quiz" | "faq" | "mindmap";

type Item = { id: string; kind: Kind; title: string; data: any; created_at: string };

const TOOLS: { kind: Kind; label: string; icon: any; desc: string }[] = [
  { kind: "summary", label: "Summary", icon: FileText, desc: "Concise exam-ready overview" },
  { kind: "notes", label: "Structured Notes", icon: BookOpen, desc: "Full study notes with headings" },
  { kind: "flashcards", label: "Flashcards", icon: Layers, desc: "Spaced-study card deck" },
  { kind: "quiz", label: "Quiz", icon: ListChecks, desc: "MCQs with explanations" },
  { kind: "faq", label: "FAQs", icon: HelpCircle, desc: "Common questions answered" },
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
      .select("id, kind, title, data, created_at")
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
              className="text-left rounded-xl border bg-surface p-3 hover:border-brand transition-colors disabled:opacity-60"
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
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconFor kind={item.kind} />
          <h2 className="font-display text-2xl">{item.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onDelete} className="text-destructive">
            Delete
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
            <Flashcards cards={item.data.cards ?? []} />
          ) : item.kind === "quiz" ? (
            <Quiz questions={item.data.questions ?? []} />
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

function Flashcards({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (cards.length === 0) return <p>No cards generated.</p>;
  const card = cards[i];
  return (
    <div>
      <div className="text-center text-sm text-muted-foreground mb-3">
        Card {i + 1} of {cards.length}
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
            setI((x) => Math.min(cards.length - 1, x + 1));
          }}
          disabled={i === cards.length - 1}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Quiz({ questions }: { questions: { q: string; options: string[]; answer: number; explanation: string }[] }) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  if (questions.length === 0) return <p>No questions generated.</p>;
  const correct = Object.entries(picks).filter(([i, p]) => questions[+i].answer === p).length;
  return (
    <div className="space-y-6">
      {questions.map((q, i) => {
        const userPick = picks[i];
        return (
          <div key={i} className="rounded-xl border bg-surface p-4">
            <div className="font-medium">
              {i + 1}. {q.q}
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
        <Button onClick={() => setSubmitted(true)} className="bg-brand text-brand-foreground hover:bg-brand/90 w-full">
          Submit
        </Button>
      ) : (
        <div className="text-center p-6 rounded-xl border bg-surface">
          <div className="font-display text-3xl">
            {correct} / {questions.length}
          </div>
          <div className="text-muted-foreground">correct</div>
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
        <div className="inline-block px-6 py-3 rounded-2xl bg-brand text-brand-foreground font-display text-2xl">
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
