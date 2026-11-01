export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="border-b border-line/80 pb-5">
        <div className="h-3 w-40 animate-pulse rounded bg-raised" />
        <div className="mt-3 h-6 w-72 animate-pulse rounded bg-raised" />
        <div className="mt-2.5 h-3 w-[420px] animate-pulse rounded bg-raised" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-xl border border-line bg-surface" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="h-[320px] animate-pulse rounded-xl border border-line bg-surface xl:col-span-8" />
        <div className="h-[320px] animate-pulse rounded-xl border border-line bg-surface xl:col-span-4" />
        <div className="h-[260px] animate-pulse rounded-xl border border-line bg-surface xl:col-span-8" />
        <div className="h-[260px] animate-pulse rounded-xl border border-line bg-surface xl:col-span-4" />
      </div>
    </div>
  );
}
