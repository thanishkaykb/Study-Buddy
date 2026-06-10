import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SourcesPanel, type Source } from "@/components/notebook/SourcesPanel";
import { ChatPanel } from "@/components/notebook/ChatPanel";
import { StudioPanel } from "@/components/notebook/StudioPanel";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_app/notebook/$notebookId")({
  component: NotebookPage,
});

function NotebookPage() {
  const { notebookId } = Route.useParams();
  const [notebook, setNotebook] = useState<{ id: string; title: string; emoji: string | null } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [highlightSource, setHighlightSource] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    const { data } = await supabase
      .from("sources")
      .select("id, title, source_type, url, char_count")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: true });
    setSources((data as Source[]) ?? []);
  }, [notebookId]);

  useEffect(() => {
    supabase
      .from("notebooks")
      .select("id, title, emoji")
      .eq("id", notebookId)
      .maybeSingle()
      .then(({ data }) => setNotebook(data as any));
    loadSources();
  }, [notebookId, loadSources]);

  const handleCiteClick = useCallback((sourceId: string) => {
    setHighlightSource(sourceId);
    const el = document.getElementById(`source-${sourceId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightSource(null), 1500);
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b bg-surface px-4 h-12 flex items-center gap-3">
        <Link to="/app" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="size-4" /> <span className="text-sm">Back</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <div className="text-xl">{notebook?.emoji ?? "📘"}</div>
        <h1 className="font-display text-lg truncate">{notebook?.title ?? "Notebook"}</h1>
      </div>
      <div className="flex-1 grid grid-cols-12 min-h-0">
        <aside className="col-span-3 border-r bg-surface min-h-0">
          <SourcesPanel
            notebookId={notebookId}
            sources={sources}
            reload={loadSources}
            highlightId={highlightSource}
          />
        </aside>
        <main className="col-span-6 min-h-0 bg-background">
          <ChatPanel notebookId={notebookId} sourcesCount={sources.length} onCiteClick={handleCiteClick} />
        </main>
        <aside className="col-span-3 border-l bg-surface min-h-0">
          <StudioPanel notebookId={notebookId} sourcesCount={sources.length} />
        </aside>
      </div>
    </div>
  );
}
