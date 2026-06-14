import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Link2, FilePlus, Plus, Trash2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/pdf";
import { useServerFn } from "@tanstack/react-start";
import { ingestUrl } from "@/lib/ai.functions";

export type Source = {
  id: string;
  title: string;
  source_type: string;
  url: string | null;
  char_count: number;
};

export function SourcesPanel({
  notebookId,
  sources,
  reload,
  highlightId,
}: {
  notebookId: string;
  sources: Source[];
  reload: () => void;
  highlightId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const ingest = useServerFn(ingestUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addText() {
    if (!textBody.trim()) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sources").insert({
      notebook_id: notebookId,
      user_id: u.user!.id,
      title: textTitle.trim() || "Untitled note",
      source_type: "text",
      content: textBody,
      char_count: textBody.length,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTextBody("");
    setTextTitle("");
    setOpen(false);
    reload();
    toast.success("Note added");
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await ingest({ data: { notebookId, url: url.trim() } });
      setUrl("");
      setOpen(false);
      reload();
      toast.success("URL ingested");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to fetch URL");
    } finally {
      setBusy(false);
    }
  }

  async function addPdf(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
          toast.error(`Skipping ${file.name} — only PDFs are supported in drop.`);
          continue;
        }
        toast.info(`Parsing ${file.name}…`);
        const text = await extractPdfText(file);
        const { error } = await supabase.from("sources").insert({
          notebook_id: notebookId,
          user_id: u.user!.id,
          title: file.name.replace(/\.pdf$/i, ""),
          source_type: "pdf",
          content: text,
          char_count: text.length,
        });
        if (error) throw error;
      }
      setOpen(false);
      reload();
      toast.success("PDF added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse PDF");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("sources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else reload();
  }

  return (
    <div
      className={`flex flex-col h-full relative ${dragging ? "ring-2 ring-brand ring-inset" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addPdf(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="absolute inset-0 bg-brand-soft/80 backdrop-blur-sm z-10 grid place-items-center pointer-events-none">
          <div className="text-center">
            <Upload className="size-12 mx-auto text-brand" />
            <div className="font-display text-xl mt-2">Drop PDFs to add</div>
          </div>
        </div>
      )}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg">Sources</h2>
          <p className="text-xs text-muted-foreground">{sources.length} item{sources.length === 1 ? "" : "s"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-brand text-brand-foreground">
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a source</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="pdf">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pdf">PDF</TabsTrigger>
                <TabsTrigger value="text">Text / Notes</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>
              <TabsContent value="pdf" className="pt-4">
                <label
                  htmlFor="pdf-upload-input"
                  className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-surface-muted hover:border-brand transition-colors"
                >
                  <Upload className="size-8 mx-auto text-brand" />
                  <div className="mt-2 font-medium">Click or drag to upload PDF(s)</div>
                  <div className="text-xs text-muted-foreground">You can select multiple files at once.</div>
                </label>
                <input
                  id="pdf-upload-input"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onClick={(e) => {
                    (e.currentTarget as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => {
                    const files = e.target.files;
                    addPdf(files);
                  }}
                  disabled={busy}
                />
                {busy && <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Processing…</div>}
              </TabsContent>
              <TabsContent value="text" className="pt-4 space-y-3">
                <Input placeholder="Title" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
                <Textarea
                  placeholder="Paste lecture transcript, notes, textbook excerpt…"
                  rows={10}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                />
                <Button onClick={addText} disabled={busy} className="gradient-brand text-brand-foreground w-full">
                  {busy ? "Adding…" : "Add note"}
                </Button>
              </TabsContent>
              <TabsContent value="url" className="pt-4 space-y-3">
                <Input placeholder="https://en.wikipedia.org/wiki/…" value={url} onChange={(e) => setUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  We extract readable article text. Paywalled pages may need pasting as Text instead.
                </p>
                <Button onClick={addUrl} disabled={busy} className="gradient-brand text-brand-foreground w-full">
                  {busy ? "Fetching…" : "Fetch & add"}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sources.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <FilePlus className="size-8 mx-auto mb-2" />
            No sources yet.
            <br />
            <span className="text-xs">Drag PDFs anywhere here, or click Add.</span>
          </div>
        ) : (
          sources.map((s, i) => (
            <div
              key={s.id}
              id={`source-${s.id}`}
              className={`group flex items-start gap-2 p-2 rounded-lg hover:bg-surface-muted ${
                highlightId === s.id ? "source-flash" : ""
              }`}
            >
              <div className="size-8 rounded-md gradient-brand text-brand-foreground grid place-items-center shrink-0">
                {s.source_type === "url" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  <span className="text-muted-foreground mr-1">[{i + 1}]</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-brand">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.source_type} · {Math.round(s.char_count / 1000)}k chars
                </div>
              </div>
              <button
                onClick={() => remove(s.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
