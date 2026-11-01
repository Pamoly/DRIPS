"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="ambient grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose/25 bg-rose/10 text-rose">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Something broke in this view</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          The workspace hit an unexpected error. Your data is safe — retry the view, or head back to the dashboard.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[10.5px] text-faint">digest {error.digest}</p>}
        <button onClick={reset} className="btn-primary btn-sm mt-5"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
      </div>
    </div>
  );
}
