import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SourcesPanel, type Source } from "@/components/notebook/SourcesPanel";
import { ChatPanel } from "@/components/notebook/ChatPanel";
import { StudioPanel } from "@/components/notebook/StudioPanel";
import { NotebookNotes } from "@/components/notebook/NotebookNotes";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notebook/$notebookId")({
  component: NotebookPage,
});

function NotebookPage() {
  const { notebookId } = Route.useParams();
  const [notebook, setNotebook] = useState<{ id: string; title: string; emoji: string | null } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [highlightSource, setHighlightSource] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

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

  async function saveTitle() {
    const t = titleDraft.trim();
    if (!t || !notebook) {
      setEditingTitle(false);
      return;
    }
    const { error } = await supabase
      .from("notebooks")
      .update({ title: t })
      .eq("id", notebookId);
    if (error) {
      toast.error(error.message);
    } else {
      setNotebook({ ...notebook, title: t });
    }
    setEditingTitle(false);
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b bg-surface px-4 h-12 flex items-center gap-3">
        <Link to="/app" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="size-4" /> <span className="text-sm">Back</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <div className="text-xl">{notebook?.emoji ?? "📘"}</div>
        {editingTitle ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              onBlur={saveTitle}
              className="h-8 max-w-xs"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={saveTitle}
              className="p-1 text-success hover:bg-surface-muted rounded"
            >
              <Check className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setTitleDraft(notebook?.title ?? "");
              setEditingTitle(true);
            }}
            className="group inline-flex items-center gap-1.5 min-w-0"
            title="Click to rename"
          >
            <h1 className="font-display text-lg truncate">{notebook?.title ?? "Notebook"}</h1>
            <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <NotebookNotes notebookId={notebookId} />
        </div>
      </div>
      <div
        className={`flex-1 min-h-0 transition-all duration-300 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={22} minSize={15} className="bg-surface">
            <SourcesPanel
              notebookId={notebookId}
              sources={sources}
              reload={loadSources}
              highlightId={highlightSource}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={38} minSize={20} className="bg-surface">
            <StudioPanel notebookId={notebookId} sourcesCount={sources.length} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25} className="bg-background">
            <ChatPanel
              notebookId={notebookId}
              sourcesCount={sources.length}
              onCiteClick={handleCiteClick}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
