import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: { n: number; title: string; source_id: string }[] | null;
  created_at: string;
};

const PROMPTS = [
  "Summarize the key concepts",
  "Give me 10 MCQs to test myself",
  "Explain in detail (11 mark answer)",
  "Give a short 3-mark answer on the main topic",
];

export function ChatPanel({
  notebookId,
  sourcesCount,
  onCiteClick,
}: {
  notebookId: string;
  sourcesCount: number;
  onCiteClick?: (sourceId: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const send = useServerFn(sendChatMessage);

  async function load() {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, citations, created_at")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setMessages((data as Message[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [notebookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function submit(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    if (sourcesCount === 0) {
      toast.error("Add at least one source first.");
      return;
    }
    setInput("");
    setSending(true);
    setMessages((m) => [
      ...m,
      {
        id: "temp-" + Date.now(),
        role: "user",
        content: msg,
        citations: [],
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      await send({ data: { notebookId, message: msg } });
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="size-14 rounded-2xl gradient-brand text-brand-foreground grid place-items-center mx-auto shadow-brand">
              <Sparkles className="size-7" />
            </div>
            <h2 className="font-display text-3xl mt-4">Ask anything about your sources</h2>
            <p className="text-muted-foreground mt-2">
              Answers are grounded in your uploaded material. Click any <span className="cite-pill">1</span> to jump to the source.
            </p>
            {sourcesCount === 0 ? (
              <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground bg-surface-muted px-4 py-2 rounded-full">
                <BookOpen className="size-4" /> Add a source on the left to start.
              </div>
            ) : (
              <div className="mt-8 grid sm:grid-cols-2 gap-2 text-left">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => submit(p)}
                    className="rounded-xl border bg-surface p-3 text-sm hover:border-brand hover:shadow-brand transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} onCiteClick={onCiteClick} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" /> StudyMind is thinking…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t bg-surface p-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder='Ask anything... e.g. "Give me an 11 mark answer on photosynthesis"'
            rows={1}
            className="resize-none min-h-[44px] max-h-40"
          />
          <Button
            onClick={() => submit()}
            disabled={sending || !input.trim()}
            className="gradient-brand text-brand-foreground h-11 px-4"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  onCiteClick,
}: {
  m: Message;
  onCiteClick?: (sourceId: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] whitespace-pre-wrap">
          {m.content}
        </div>
      </div>
    );
  }

  const citationMap = new Map<number, string>();
  (m.citations ?? []).forEach((c) => citationMap.set(c.n, c.source_id));

  // Replace [n] in content with placeholder tokens, then render as pills
  const parts = m.content.split(/(\[\d+\])/g);

  return (
    <div>
      <div className="prose-chat text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p>{renderCites(children, citationMap, onCiteClick)}</p>,
            li: ({ children }) => <li>{renderCites(children, citationMap, onCiteClick)}</li>,
            td: ({ children }) => <td>{renderCites(children, citationMap, onCiteClick)}</td>,
          }}
        >
          {m.content}
        </ReactMarkdown>
      </div>
      {m.citations && m.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.citations.map((c) => (
            <button
              key={c.n}
              onClick={() => onCiteClick?.(c.source_id)}
              className="inline-flex items-center gap-1 text-xs bg-brand-soft text-accent-foreground px-2 py-0.5 rounded-full hover:bg-brand hover:text-brand-foreground transition-colors"
              title={`Jump to source: ${c.title}`}
            >
              [{c.n}] {c.title.length > 30 ? c.title.slice(0, 30) + "…" : c.title}
            </button>
          ))}
        </div>
      )}
      {void parts}
    </div>
  );
}

function renderCites(
  children: React.ReactNode,
  map: Map<number, string>,
  onClick?: (sid: string) => void,
): React.ReactNode {
  if (typeof children === "string") {
    return children.split(/(\[\d+\])/g).map((seg, i) => {
      const m = seg.match(/^\[(\d+)\]$/);
      if (m) {
        const n = parseInt(m[1], 10);
        const sid = map.get(n);
        return (
          <span
            key={i}
            className="cite-pill"
            onClick={() => sid && onClick?.(sid)}
            title={sid ? "Jump to source" : undefined}
          >
            {n}
          </span>
        );
      }
      return seg;
    });
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => <span key={i}>{renderCites(c, map, onClick)}</span>);
  }
  return children;
}
