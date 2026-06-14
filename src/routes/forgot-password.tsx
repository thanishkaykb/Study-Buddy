import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, GraduationCap, MailCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Study Buddy" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border bg-surface p-8 shadow-brand">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <div className="size-12 rounded-xl gradient-brand text-brand-foreground grid place-items-center">
          {sent ? <MailCheck className="size-6" /> : <GraduationCap className="size-6" />}
        </div>
        <h1 className="font-display text-2xl mt-4">
          {sent ? "Check your email" : "Forgot your password?"}
        </h1>
        {sent ? (
          <p className="text-muted-foreground mt-2">
            We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mt-2 text-sm">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 gradient-brand text-brand-foreground"
              >
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
