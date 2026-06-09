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

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b bg-surface px-4 h-12 flex items-center gap-3">
        <Link to="/app" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="text-xl">{notebook?.emoji ?? "📘"}</div>
        <h1 className="font-display text-lg truncate">{notebook?.title ?? "Notebook"}</h1>
      </div>
      <div className="flex-1 grid grid-cols-12 min-h-0">
        <aside className="col-span-3 border-r bg-surface min-h-0">
          <SourcesPanel notebookId={notebookId} sources={sources} reload={loadSources} />
        </aside>
        <main className="col-span-6 min-h-0 bg-background">
          <ChatPanel notebookId={notebookId} sourcesCount={sources.length} />
        </main>
        <aside className="col-span-3 border-l bg-surface min-h-0">
          <StudioPanel notebookId={notebookId} sourcesCount={sources.length} />
        </aside>
      </div>
    </div>
  );
}
