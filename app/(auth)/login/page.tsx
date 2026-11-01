import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  // Guests may revisit sign-in to upgrade to a full seat.
  if (user && !user.isGuest) redirect("/");

  return (
    <div className="ambient relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface/40 p-10 lg:flex">
        <div className="absolute inset-0 grid-lines opacity-[0.35]" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand/15 ring-1 ring-brand/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2.7c3.6 4.3 6.4 7.7 6.4 11.1a6.4 6.4 0 0 1-12.8 0c0-3.4 2.8-6.8 6.4-11.1Z" />
              </svg>
            </span>
            <span className="text-[16px] font-semibold tracking-[-0.02em]">DRIPS<span className="text-brand">.</span></span>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Guest tour available · no account needed
          </p>
          <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            Every keyword, audit and competitor in one <span className="text-brand">signal.</span>
          </h1>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-muted">
            Research demand, monitor rankings across global and local engines, optimize content as you type, and ship
            white-label client reports — without juggling five tools. Or take a read-only guest tour of the live demo.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { k: "Rank tracking", v: "Daily · 190+ countries", d: "Desktop, mobile, Bing & local packs" },
              { k: "Site audits", v: "Instant crawl", d: "250+ technical & on-page checks" },
              { k: "AI visibility", v: "5 answer engines", d: "ChatGPT, Perplexity, Gemini, SGE" },
              { k: "Reporting", v: "White-label", d: "Scheduled email + public links" },
            ].map((f) => (
              <div key={f.k} className="rounded-xl border border-line bg-surface/70 p-3.5 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.12em] text-faint">{f.k}</p>
                <p className="mt-1 text-[13px] font-medium">{f.v}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-4 text-[11px] text-faint">
          <span>Trusted by growth teams at</span>
          <span className="font-medium text-muted">Northwind</span>
          <span className="font-medium text-muted">Lumen</span>
          <span className="font-medium text-muted">Verdant</span>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <LoginForm />
      </div>
    </div>
  );
}
