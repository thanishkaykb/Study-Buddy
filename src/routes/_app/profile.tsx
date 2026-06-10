import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, Lock, Trash2, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile & settings — StudyMind" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, phone")
        .eq("id", u.user.id)
        .maybeSingle();
      setName(p?.display_name ?? "");
      setPhone(p?.phone ?? "");
      setLoading(false);
    })();
  }, []);

  async function saveProfile() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() || null, phone: phone.trim() || null })
        .eq("id", u.user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw("");
      toast.success("Password updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Delete user-owned data (notebooks cascade, plus profile)
      await supabase.from("notebooks").delete().eq("user_id", u.user.id);
      await supabase.from("profiles").delete().eq("id", u.user.id);
      await supabase.auth.signOut();
      toast.success("Account data deleted. Signing you out.");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto p-10 text-muted-foreground">Loading…</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-display text-4xl">Profile & settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, password and data.</p>
      </div>

      <Card title="Personal info" icon={User}>
        <Field label="Name" icon={User}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email" icon={Mail}>
          <Input value={email} disabled />
        </Field>
        <Field label="Phone (optional — backup)" icon={Phone}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
        </Field>
        <Button onClick={saveProfile} disabled={busy} className="gradient-brand text-brand-foreground">
          Save changes
        </Button>
      </Card>

      <Card title="Change password" icon={Lock}>
        <Field label="New password" icon={Lock}>
          <Input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 6 characters"
          />
        </Field>
        <Button onClick={changePassword} disabled={busy || !newPw} variant="outline">
          Update password
        </Button>
      </Card>

      <Card title="Danger zone" icon={Trash2} danger>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all notebooks, sources, chats and study items. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="size-4 mr-2" /> Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                All your notebooks, sources, chats, flashcards and quiz history will be deleted permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </main>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  danger,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-6 space-y-4 ${danger ? "border-destructive/40" : ""}`}>
      <h2 className={`font-display text-xl flex items-center gap-2 ${danger ? "text-destructive" : ""}`}>
        <Icon className="size-5" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-sm">
        <Icon className="size-3.5" /> {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
