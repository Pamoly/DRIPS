import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import clsx from "clsx";

/**
 * Shown to guests (read-only sessions) wherever an action would normally write data.
 */
export function SignInToEdit({
  what = "make changes",
  compact = false,
  className,
}: {
  what?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/[0.07] px-2 py-1 text-[11.5px] text-brand",
        className,
      )}
      title="Guest sessions are read-only"
    >
      <Lock className="h-3 w-3 shrink-0" />
      {compact ? "Read-only" : `Guest view · sign in to ${what}`}
    </span>
  );
}

export function GuestCta({ className }: { className?: string }) {
  return (
    <Link href="/login" className={clsx("btn-primary btn-sm", className)}>
      Sign in for full access <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
