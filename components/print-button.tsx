"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary btn-sm no-print">
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
