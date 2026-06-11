import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/app")({
  head: () => ({ meta: [{ title: "Your notebooks — StudyMind" }] }),
  component: Dashboard,
});

type Notebook = {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  completed: boolean;
  updated_at: string;
};

function Dashboard() {
  const [items, setItems] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [completed, setCompleted] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("notebooks")
      .select("id, title, description, emoji, completed, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Notebook[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setDesc("");
    setCompleted(false);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(nb: Notebook) {
    setEditing(nb);
    setTitle(nb.title);
    setDesc(nb.description ?? "");
    setCompleted(nb.completed);
    setOpen(true);
  }

  async function save() {
    if (!title.trim()) return;
    if (editing) {
      const { error } = await supabase
        .from("notebooks")
        .update({ title: title.trim(), description: desc.trim() || null, completed })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("notebooks")
        .insert({
          title: title.trim(),
          description: desc.trim() || null,
          completed,
          user_id: u.user.id,
        });
      if (error) return toast.error(error.message);
    }
    setOpen(false);
    resetForm();
    load();
  }

  async function toggleComplete(nb: Notebook) {
    const { error } = await supabase
      .from("notebooks")
      .update({ completed: !nb.completed })
      .eq("id", nb.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this notebook and all its sources?")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Your notebooks</h1>
          <p className="text-muted-foreground mt-1">One notebook per topic, subject or exam.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Plus className="size-4 mr-1" /> New notebook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit notebook" : "Create a notebook"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Organic Chemistry – Unit 3"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What's this notebook about?"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox checked={completed} onCheckedChange={(v) => setCompleted(!!v)} />
                Mark as completed
              </label>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-brand text-brand-foreground hover:bg-brand/90">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <BookOpen className="size-10 mx-auto text-muted-foreground" />
          <h3 className="font-display text-2xl mt-4">No notebooks yet</h3>
          <p className="text-muted-foreground mt-1">Create your first notebook to start studying.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((nb) => (
            <div
              key={nb.id}
              className={`group relative rounded-2xl border bg-surface p-5 hover:border-brand transition-colors ${
                nb.completed ? "opacity-75" : ""
              }`}
            >
              <Link
                to="/notebook/$notebookId"
                params={{ notebookId: nb.id }}
                className="block"
              >
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{nb.emoji ?? "📘"}</div>
                  {nb.completed && (
                    <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="size-3" /> Completed
                    </span>
                  )}
                </div>
                <h3 className={`font-display text-xl mt-3 line-clamp-1 ${nb.completed ? "line-through" : ""}`}>
                  {nb.title}
                </h3>
                {nb.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{nb.description}</p>
                )}
                <div className="text-xs text-muted-foreground mt-4">
                  Updated {formatDistanceToNow(new Date(nb.updated_at))} ago
                </div>
              </Link>
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); toggleComplete(nb); }}
                  className="p-1.5 rounded-md hover:bg-surface-muted text-muted-foreground hover:text-success"
                  title={nb.completed ? "Mark as not completed" : "Mark as completed"}
                >
                  <CheckCircle2 className="size-4" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); openEdit(nb); }}
                  className="p-1.5 rounded-md hover:bg-surface-muted text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); remove(nb.id); }}
                  className="p-1.5 rounded-md hover:bg-surface-muted text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
