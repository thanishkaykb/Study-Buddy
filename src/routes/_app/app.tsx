import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Trash2 } from "lucide-react";
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
  updated_at: string;
};

const EMOJIS = ["📘", "📗", "📙", "📕", "🧠", "🔬", "📐", "🧪", "🌍", "💡", "⚖️", "🎨"];

function Dashboard() {
  const [items, setItems] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("📘");

  async function load() {
    const { data, error } = await supabase
      .from("notebooks")
      .select("id, title, description, emoji, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Notebook[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!title.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("notebooks")
      .insert({ title: title.trim(), description: desc.trim() || null, emoji, user_id: u.user.id });
    if (error) return toast.error(error.message);
    setOpen(false);
    setTitle("");
    setDesc("");
    setEmoji("📘");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this notebook and all its sources?")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl">Your notebooks</h1>
          <p className="text-muted-foreground mt-1">One notebook per topic, subject or exam.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Plus className="size-4 mr-1" /> New notebook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a notebook</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Icon</label>
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`size-9 rounded-lg text-lg grid place-items-center border ${
                        emoji === e ? "border-brand bg-brand-soft" : "border-border"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organic Chemistry – Unit 3" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this notebook about?" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} className="bg-brand text-brand-foreground hover:bg-brand/90">
                Create
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
            <Link
              key={nb.id}
              to="/notebook/$notebookId"
              params={{ notebookId: nb.id }}
              className="group rounded-2xl border bg-surface p-5 hover:border-brand transition-colors relative"
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{nb.emoji ?? "📘"}</div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    remove(nb.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <h3 className="font-display text-xl mt-3 line-clamp-1">{nb.title}</h3>
              {nb.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{nb.description}</p>
              )}
              <div className="text-xs text-muted-foreground mt-4">
                Updated {formatDistanceToNow(new Date(nb.updated_at))} ago
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
