import { GraduationCap } from "lucide-react";

export function StudyBuddyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-9 rounded-xl gradient-brand text-brand-foreground grid place-items-center shadow-brand shrink-0">
        <GraduationCap className="size-5" />
      </div>
      {!compact && <span className="font-display text-xl">Study Buddy</span>}
    </div>
  );
}
