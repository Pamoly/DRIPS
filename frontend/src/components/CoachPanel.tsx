import React, { useState } from 'react';
import { Award, BookOpen, CheckCircle2, GraduationCap, Sparkles, Target } from 'lucide-react';
import { useWorkspace } from '../store/WorkspaceContext';
import { cn } from '../lib/format';
import { Empty, Panel } from './ui';

export function CoachPanel() {
  const { learning, completeLesson, askMentor, findings } = useWorkspace();
  const [openLesson, setOpenLesson] = useState<string | null>(learning?.next_lessons?.[0]?.id ?? null);

  if (!learning) return <Empty title="Loading your learning path…" />;

  const { learner, level, tracks, next_lessons, recommended_track, badges, levels } = learning;
  const earned = new Set(learner.badges.map((badge) => badge.id));

  return (
    <div className="min-h-0 space-y-3 overflow-auto p-3">
      <Panel
        title={`Level ${level.n} · ${level.title}`}
        subtitle={level.focus}
        actions={<span className="font-mono text-xs text-slate-300">{learner.xp} XP</span>}
      >
        <div className="h-2 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-400 to-moss-400 transition-all duration-700"
            style={{ width: `${level.progress_to_next}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {level.next
            ? `${level.progress_to_next.toFixed(0)}% of the way to ${level.next.title} (${level.next.xp} XP)`
            : 'Top level — the next step is mentoring someone else through a review.'}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="badges" value={`${earned.size}/${badges.length}`} icon={<Award size={13} />} />
          <MiniStat label="lessons done" value={String(learner.completed_lessons.length)} icon={<GraduationCap size={13} />} />
          <MiniStat label="open findings" value={String(findings.length)} icon={<Target size={13} />} />
        </div>
      </Panel>

      <Panel title="Recommended track" subtitle={recommended_track.reason} actions={<Sparkles size={14} className="text-accent-300" />}>
        <p className="text-[13px] font-medium text-slate-100">{recommended_track.name}</p>
        <div className="mt-2 space-y-1">
          {levels.map((item) => (
            <div key={item.n} className="flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded font-mono text-[10px]',
                  learner.xp >= item.xp ? 'bg-emerald-500/20 text-emerald-200' : 'bg-ink-700 text-slate-500',
                )}
              >
                {item.n}
              </span>
              <span className={learner.xp >= item.xp ? 'text-slate-200' : 'text-slate-500'}>{item.title}</span>
              <span className="ml-auto font-mono text-[10px] text-slate-500">{item.xp} XP</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Your next lessons" subtitle="Chosen from the findings in your own code">
        {next_lessons.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            Core path complete. Pick a real feature, build it, and bring the diff here for review.
          </p>
        ) : (
          <div className="space-y-2">
            {next_lessons.map((lesson) => {
              const open = openLesson === lesson.id;
              return (
                <article key={lesson.id} className="rounded-lg border border-ink-700/70 bg-ink-900/50">
                  <button
                    className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left"
                    onClick={() => setOpenLesson(open ? null : lesson.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-slate-100">{lesson.title}</span>
                      <span className="block text-[11px] text-slate-500">
                        {lesson.skill} · {lesson.minutes} min
                        {lesson.matched_findings ? ` · matches ${lesson.matched_findings} of your findings` : ''}
                      </span>
                    </span>
                    <BookOpen size={14} className="mt-0.5 flex-shrink-0 text-accent-300" />
                  </button>

                  {open && (
                    <div className="animate-fade-in space-y-2 border-t border-ink-700/60 px-3 py-2.5 text-[12px]">
                      <p className="text-slate-300">{lesson.why}</p>
                      {lesson.read && (
                        <ul className="ml-4 list-disc space-y-1 text-slate-300">
                          {lesson.read.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                      {lesson.practice && (
                        <p className="text-slate-300">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Practice · </span>
                          {lesson.practice}
                        </p>
                      )}
                      {lesson.check && (
                        <p className="text-slate-300">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Done when · </span>
                          {lesson.check}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          className="btn-primary text-[11px]"
                          onClick={() =>
                            askMentor(
                              `Start lesson "${lesson.title}" (${lesson.skill}). Teach me the ideas, use my own file ${''} for the examples, then quiz me with two questions.`,
                            )
                          }
                        >
                          Start with the mentor
                        </button>
                        <button className="btn-outline text-[11px]" onClick={() => completeLesson(lesson.id)}>
                          <CheckCircle2 size={13} /> Mark complete (+25 XP)
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Badges" subtitle="Earned by doing the work, not by clicking">
        <div className="grid grid-cols-3 gap-2">
          {badges.map((badge) => {
            const owned = earned.has(badge.id);
            return (
              <div
                key={badge.id}
                title={badge.description}
                className={cn(
                  'rounded-lg border p-2 text-center',
                  owned ? 'border-accent-500/40 bg-accent-500/10' : 'border-ink-700 bg-ink-900/40 opacity-45',
                )}
              >
                <div className="text-lg">{badge.icon}</div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-200">{badge.name}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Your tracks" subtitle="Beginner → professional, in the order reviewers care about">
        <div className="space-y-2">
          {tracks.map((track) => {
            const done = track.lessons.filter((lesson) => lesson.completed).length;
            return (
              <div key={track.id} className="rounded-lg bg-ink-900/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-medium text-slate-100">{track.name}</p>
                  <span className="chip bg-ink-700/60 text-slate-300 ring-ink-600">{track.level}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{track.summary}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-accent-400/80"
                    style={{ width: `${track.lessons.length ? (done / track.lessons.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {done}/{track.lessons.length} lessons
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-accent-200">
        {icon}
        <span className="font-mono text-sm text-slate-100">{value}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
