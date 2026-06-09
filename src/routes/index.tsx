import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, BookOpen, MessageSquareText, Layers, Lightbulb, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyMind AI — Your AI study workspace" },
      {
        name: "description",
        content:
          "Upload PDFs, notes, lectures and URLs. Chat with your materials, generate summaries, flashcards, quizzes, mind maps and FAQs — all with cited answers.",
      },
      { property: "og:title", content: "StudyMind AI — Your AI study workspace" },
      {
        property: "og:description",
        content:
          "Turn any study material into summaries, flashcards, quizzes and a chat tutor that cites your sources.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
      else setChecking(false);
    });
  }, [navigate]);
  if (checking)
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] pointer-events-none" />
      <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-brand text-brand-foreground grid place-items-center shadow-sm">
            <Brain className="size-5" />
          </div>
          <span className="font-display text-xl">StudyMind</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-accent-foreground text-xs mb-6">
          <Sparkles className="size-3.5" /> Your private AI tutor — trained on your own notes
        </div>
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] max-w-4xl mx-auto">
          Turn any study material into an
          <span className="text-brand"> AI study workspace</span>.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload PDFs, lecture notes, textbooks and URLs. Chat with cited answers, generate summaries, flashcards,
          quizzes, mind maps and FAQs — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90">
              Start free <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-4 text-left">
          {[
            { icon: BookOpen, title: "All your sources", desc: "Drop in PDFs, paste notes, add URLs, dump lecture transcripts." },
            { icon: MessageSquareText, title: "Chat with citations", desc: "Get long-form 11-mark answers, short points, or MCQ sets — always cited." },
            { icon: Layers, title: "Flashcards & quizzes", desc: "One click generates flashcards and practice tests from your material." },
            { icon: Lightbulb, title: "Mind maps & FAQs", desc: "Visualize the whole topic and prep with auto-generated FAQs." },
            { icon: Brain, title: "Grounded in your notes", desc: "The assistant only answers from what you uploaded — no internet hallucinations." },
            { icon: Sparkles, title: "Smart length matching", desc: "Ask for 3-mark? Get points. Ask for 11-mark? Get pages." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-surface p-5">
              <div className="size-10 rounded-lg bg-brand-soft text-accent-foreground grid place-items-center mb-3">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
