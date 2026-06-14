import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingDown, TrendingUp, Target, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Quiz analytics — Study Buddy" }] }),
  component: AnalyticsPage,
});

type Attempt = {
  id: string;
  notebook_id: string;
  score: number;
  total: number;
  topics: string[];
  created_at: string;
};

function AnalyticsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [notebooks, setNotebooks] = useState<Record<string, { title: string; emoji: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase
        .from("quiz_attempts")
        .select("id, notebook_id, score, total, topics, created_at")
        .order("created_at", { ascending: false });
      setAttempts((a as Attempt[]) ?? []);
      const { data: nbs } = await supabase.from("notebooks").select("id, title, emoji");
      const map: Record<string, { title: string; emoji: string | null }> = {};
      (nbs ?? []).forEach((n: any) => (map[n.id] = { title: n.title, emoji: n.emoji }));
      setNotebooks(map);
      setLoading(false);
    })();
  }, []);

  const total = attempts.length;
  const avg =
    total > 0
      ? Math.round(
          (attempts.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / total) * 100,
        )
      : 0;

  // Topic aggregates
  const topicMap = new Map<string, { correct: number; total: number; nbIds: Set<string> }>();
  attempts.forEach((a) => {
    const pct = a.total > 0 ? a.score / a.total : 0;
    a.topics.forEach((t) => {
      const cur = topicMap.get(t) ?? { correct: 0, total: 0, nbIds: new Set() };
      cur.correct += Math.round(pct * 10);
      cur.total += 10;
      cur.nbIds.add(a.notebook_id);
      topicMap.set(t, cur);
    });
  });
  const topics = Array.from(topicMap.entries())
    .map(([t, v]) => ({ topic: t, pct: Math.round((v.correct / v.total) * 100), nbIds: Array.from(v.nbIds) }))
    .sort((a, b) => a.pct - b.pct);

  const weak = topics.slice(0, 5);
  const strong = [...topics].reverse().slice(0, 5);

  if (loading) return <div className="max-w-5xl mx-auto p-10 text-muted-foreground">Loading…</div>;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2">
          <BarChart3 className="size-8 text-brand" /> Quiz analytics
        </h1>
        <p className="text-muted-foreground mt-1">Track your scores, weak topics and progress over time.</p>
      </div>

      {total === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <Target className="size-10 mx-auto text-muted-foreground" />
          <h3 className="font-display text-2xl mt-4">No quizzes taken yet</h3>
          <p className="text-muted-foreground mt-1">Generate and submit a quiz to see your analytics here.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="Quizzes taken" value={String(total)} />
            <Stat label="Average score" value={`${avg}%`} highlight />
            <Stat label="Topics practiced" value={String(topics.length)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Weak areas" icon={TrendingDown} accent="destructive">
              {weak.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topic data yet.</p>
              ) : (
                <div className="space-y-2">
                  {weak.map((t) => (
                    <TopicBar key={t.topic} {...t} notebooks={notebooks} />
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Strong areas" icon={TrendingUp} accent="success">
              {strong.length === 0 ? (
                <p className="text-sm text-muted-foreground">No topic data yet.</p>
              ) : (
                <div className="space-y-2">
                  {strong.map((t) => (
                    <TopicBar key={t.topic} {...t} notebooks={notebooks} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Recent attempts" icon={BookOpen}>
            <div className="divide-y">
              {attempts.slice(0, 15).map((a) => {
                const pct = Math.round((a.score / Math.max(1, a.total)) * 100);
                const nb = notebooks[a.notebook_id];
                return (
                  <Link
                    key={a.id}
                    to="/notebook/$notebookId"
                    params={{ notebookId: a.notebook_id }}
                    className="py-2.5 flex items-center justify-between hover:bg-surface-muted -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xl">{nb?.emoji ?? "📘"}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{nb?.title ?? "Notebook"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()} · {a.topics.slice(0, 3).join(", ")}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>
                      {a.score}/{a.total} ({pct}%)
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-surface p-5 ${highlight ? "shadow-brand" : ""}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`font-display text-4xl mt-1 ${highlight ? "text-gradient-brand" : ""}`}>{value}</div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: any;
  accent?: "success" | "destructive";
  children: React.ReactNode;
}) {
  const color = accent === "destructive" ? "text-destructive" : accent === "success" ? "text-success" : "text-brand";
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <h2 className={`font-display text-lg flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="size-5" /> {title}
      </h2>
      {children}
    </div>
  );
}

function TopicBar({
  topic,
  pct,
  nbIds,
  notebooks,
}: {
  topic: string;
  pct: number;
  nbIds: string[];
  notebooks: Record<string, { title: string; emoji: string | null }>;
}) {
  const color = pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  const nb = notebooks[nbIds[0]];
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate">{topic}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {nb && (
        <Link
          to="/notebook/$notebookId"
          params={{ notebookId: nbIds[0] }}
          className="text-xs text-muted-foreground hover:text-brand"
        >
          Practice in {nb.emoji} {nb.title} →
        </Link>
      )}
    </div>
  );
}
