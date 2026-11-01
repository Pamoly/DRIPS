import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="ambient grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-brand">
          <Compass className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.025em]">This page isn&apos;t in the crawl</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          The project, report or audit you&apos;re looking for doesn&apos;t exist — or you don&apos;t have access to it.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="btn-primary btn-sm">Back to workspace</Link>
          <Link href="/docs" className="btn-ghost btn-sm">Read the docs</Link>
        </div>
      </div>
    </div>
  );
}
