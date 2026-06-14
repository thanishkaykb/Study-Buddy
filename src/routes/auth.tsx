import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { StudyBuddyLogo } from "@/components/brand-logo";
import { ensureProfile } from "@/lib/profile.client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Study Buddy" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifySent, setVerifySent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        await ensureProfile(data.user);
        navigate({ to: "/app" });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setTimeout(async () => {
          await ensureProfile(session.user);
          navigate({ to: "/app" });
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session?.user) {
          await ensureProfile(data.session.user);
          toast.success("Account created!");
        } else {
          setVerifySent(email);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await ensureProfile(data.user);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setBusy(false);
    }
  }

  if (verifySent) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <div className="w-full max-w-md rounded-2xl border bg-surface p-8 text-center shadow-brand">
          <div className="size-14 rounded-2xl gradient-brand text-brand-foreground grid place-items-center mx-auto">
            <MailCheck className="size-7" />
          </div>
          <h1 className="font-display text-2xl mt-4">Check your email</h1>
          <p className="text-muted-foreground mt-2">
            We sent a verification link to <span className="font-medium text-foreground">{verifySent}</span>.
            Click it to activate your account, then come back to sign in.
          </p>
          <Button
            onClick={() => {
              setVerifySent(null);
              setMode("signin");
            }}
            className="mt-6 w-full gradient-brand text-brand-foreground"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex relative bg-aurora p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative"><StudyBuddyLogo /></div>
        <div className="relative">
          <h2 className="font-display text-5xl leading-[1.05]">
            Your private <span className="text-gradient-brand">AI tutor</span>, trained on your own notes.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Upload PDFs, notes and URLs. Get summaries, flashcards, quizzes and cited answers.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">© Study Buddy</div>
      </div>

      <div className="flex items-center justify-center p-6 relative">
        <Link
          to="/"
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === "signin" ? "Sign in to your study workspace." : "Takes 10 seconds. Free to start."}
          </p>

          <Button
            onClick={google}
            disabled={busy}
            variant="outline"
            className="w-full mt-6 h-11 gap-2"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <Link to="/forgot-password" className="text-xs text-brand hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 gradient-brand text-brand-foreground"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 text-sm text-muted-foreground text-center">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-brand font-medium hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
