import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  CheckSquare,
  StickyNote,
  Type,
  Save,
} from "lucide-react";
import { toast } from "sonner";

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "6" },
];

export function NotebookNotes({ notebookId }: { notebookId: string }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("notebooks")
      .select("notes_html")
      .eq("id", notebookId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const initial = (data as any)?.notes_html ?? "";
        setHtml(initial);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  // load editor contents when popover opens
  useEffect(() => {
    if (open && editorRef.current && loaded) {
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html;
      }
    }
  }, [open, loaded, html]);

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  }

  function insertChecklistItem() {
    editorRef.current?.focus();
    const id = "cb-" + Math.random().toString(36).slice(2, 9);
    const html = `<div class="nb-task"><input type="checkbox" id="${id}" class="nb-task-cb" /> <span contenteditable="true">Task</span></div><div><br/></div>`;
    document.execCommand("insertHTML", false, html);
    handleInput();
  }

  function handleInput() {
    if (!editorRef.current) return;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 1200);
  }

  // Persist checkbox state in HTML (checked attribute) so it survives save/load
  function handleEditorClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" && (t as HTMLInputElement).type === "checkbox") {
      const cb = t as HTMLInputElement;
      // Reflect new state in the DOM attribute
      setTimeout(() => {
        if (cb.checked) cb.setAttribute("checked", "");
        else cb.removeAttribute("checked");
        handleInput();
      }, 0);
    }
  }

  async function save() {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    setSaving(true);
    const { error } = await supabase
      .from("notebooks")
      .update({ notes_html: content })
      .eq("id", notebookId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHtml(content);
    setDirty(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <StickyNote className="size-4" />
          <span className="hidden sm:inline">Notes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(560px,92vw)] p-0 overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-1 border-b p-2 bg-surface">
          <ToolBtn onClick={() => exec("bold")} title="Bold (Ctrl+B)">
            <Bold className="size-4" />
          </ToolBtn>
          <ToolBtn onClick={() => exec("italic")} title="Italic">
            <Italic className="size-4" />
          </ToolBtn>
          <ToolBtn onClick={() => exec("underline")} title="Underline">
            <Underline className="size-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-8 px-2 rounded hover:bg-surface-muted inline-flex items-center gap-1 text-sm"
                title="Font size"
              >
                <Type className="size-4" /> Size
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => exec("fontSize", s.value)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-surface-muted text-sm"
                >
                  {s.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn onClick={() => exec("insertUnorderedList")} title="Bullet list">
            <List className="size-4" />
          </ToolBtn>
          <ToolBtn onClick={() => exec("insertOrderedList")} title="Numbered list">
            <ListOrdered className="size-4" />
          </ToolBtn>
          <ToolBtn onClick={insertChecklistItem} title="Checklist item">
            <CheckSquare className="size-4" />
          </ToolBtn>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
            </span>
            <Button size="sm" variant="ghost" onClick={save} disabled={!dirty}>
              <Save className="size-4 mr-1" /> Save
            </Button>
          </div>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleEditorClick}
          className="nb-notes-editor min-h-[260px] max-h-[60vh] overflow-y-auto p-4 text-sm focus:outline-none"
          data-placeholder="Take notes, jot a checklist, track tasks…"
        />
      </PopoverContent>
    </Popover>
  );
}

function ToolBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="h-8 w-8 grid place-items-center rounded hover:bg-surface-muted text-foreground"
    >
      {children}
    </button>
  );
}
