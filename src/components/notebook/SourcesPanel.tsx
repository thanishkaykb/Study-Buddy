import { useState } from "react";
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
}: {
  notebookId: string;
  sources: Source[];
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [url, setUrl] = useState("");
  const ingest = useServerFn(ingestUrl);

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

  async function addPdf(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg">Sources</h2>
          <p className="text-xs text-muted-foreground">{sources.length} item{sources.length === 1 ? "" : "s"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
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
                <label className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-surface-muted">
                  <Upload className="size-8 mx-auto text-muted-foreground" />
                  <div className="mt-2 font-medium">Click to upload PDF(s)</div>
                  <div className="text-xs text-muted-foreground">Textbooks, slides, lecture notes…</div>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => addPdf(e.target.files)}
                    disabled={busy}
                  />
                </label>
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
                <Button onClick={addText} disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90 w-full">
                  {busy ? "Adding…" : "Add note"}
                </Button>
              </TabsContent>
              <TabsContent value="url" className="pt-4 space-y-3">
                <Input placeholder="https://en.wikipedia.org/wiki/…" value={url} onChange={(e) => setUrl(e.target.value)} />
                <Button onClick={addUrl} disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90 w-full">
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
            Add PDFs, notes or URLs.
          </div>
        ) : (
          sources.map((s, i) => (
            <div key={s.id} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-surface-muted">
              <div className="size-8 rounded-md bg-brand-soft text-accent-foreground grid place-items-center shrink-0">
                {s.source_type === "url" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  <span className="text-muted-foreground mr-1">[{i + 1}]</span>
                  {s.title}
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
