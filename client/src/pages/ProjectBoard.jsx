import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Filter,
  Flag,
  GripVertical,
  Kanban,
  ListChecks,
  MoreHorizontal,
  Plus,
  Rows3,
  Target,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { addDays, cx, daysBetween, fmtDate, groupBy, round2, sortBy, sum, todayISO, uid, weekStart } from '../lib/format';
import { boardStats, sprintBurndown } from '../lib/metrics';
import { boardWorkbook } from '../lib/excel';
import { boardPDF, savePdf } from '../lib/pdf';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  KPI,
  MenuItem,
  Modal,
  PageHeader,
  Pill,
  Progress,
  SearchInput,
  SectionTitle,
  Segmented,
  Select,
  StatusPill,
  Textarea,
} from '../components/ui';

export const COLUMNS = [
  { id: 'backlog', label: 'Backlog', tone: '#8AA0C8' },
  { id: 'todo', label: 'To do', tone: '#21468B' },
  { id: 'doing', label: 'In progress', tone: '#AE1C28' },
  { id: 'review', label: 'Review', tone: '#D9930B' },
  { id: 'done', label: 'Done', tone: '#12A06A' },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_TONE = { low: 'neutral', medium: 'blue', high: 'amber', urgent: 'red' };
const LABEL_COLORS = ['#AE1C28', '#21468B', '#12A06A', '#D9930B', '#5B3FA8', '#0E7C66', '#B26A00'];

export default function ProjectBoard() {
  const app = useApp();
  const { collections, clientMap, projectMap, addItem, updateItem, removeItem, replaceItems, toast, settings, locale } = app;
  const { m } = useMoney();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(params.get('view') === 'calendar' ? 'calendar' : 'board');
  const [sprintId, setSprintId] = useState(params.get('sprint') || 'all');
  const [projectId, setProjectId] = useState(params.get('project') || 'all');
  const [q, setQ] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [label, setLabel] = useState('all');
  const [taskModal, setTaskModal] = useState(null);
  const [sprintModal, setSprintModal] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [wipLimits] = useState({ doing: 3, review: 3 });

  const hoursPerPoint = Number(settings?.defaults?.hoursPerPoint) || 4;
  const tasks = collections.tasks || [];
  const sprints = collections.sprints || [];
  const projects = collections.projects || [];

  useEffect(() => {
    if (params.get('new') === '1') {
      setTaskModal({});
      params.delete('new');
      setParams(params, { replace: true });
    }
    if (params.get('focus')) {
      const t = tasks.find((x) => x.id === params.get('focus'));
      if (t) setTaskModal(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (sprintId !== 'all' && (t.sprintId || '') !== (sprintId === 'none' ? '' : sprintId)) return false;
      if (projectId !== 'all' && (t.projectId || '') !== projectId) return false;
      if (assignee !== 'all' && (t.assignee || '') !== assignee) return false;
      if (label !== 'all' && !(t.labels || []).includes(label)) return false;
      if (!needle) return true;
      return [t.title, t.description, t.assignee, (t.labels || []).join(' ')].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [tasks, sprintId, projectId, assignee, label, q]);

  const stats = boardStats(filtered, '');
  const activeSprint = sprints.find((s) => s.id === sprintId) || sprints.find((s) => s.status === 'active');
  const burndown = activeSprint ? sprintBurndown(tasks, activeSprint) : [];
  const assignees = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))];
  const labels = [...new Set(tasks.flatMap((t) => t.labels || []))].sort();

  /* ------------------------------ drag & drop ----------------------------- */
  const moveTask = (taskId, column, beforeId = null) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const patch = { column };
    if (column === 'done' && task.column !== 'done') patch.completedAt = new Date().toISOString();
    if (column !== 'done') patch.completedAt = '';
    updateItem('tasks', taskId, patch, { debounce: 0 });

    if (beforeId && beforeId !== taskId) {
      const rows = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
      const from = rows.findIndex((t) => t.id === taskId);
      const [moved] = rows.splice(from, 1);
      const to = rows.findIndex((t) => t.id === beforeId);
      rows.splice(to < 0 ? rows.length : to, 0, moved);
      replaceItems('tasks', rows.map((t, i) => ({ ...t, order: i })));
    }
  };

  const nudge = (task, dir) => {
    const idx = COLUMNS.findIndex((c) => c.id === (task.column || 'backlog'));
    const next = COLUMNS[Math.min(COLUMNS.length - 1, Math.max(0, idx + dir))];
    if (next && next.id !== task.column) {
      moveTask(task.id, next.id);
      toast(`${task.title} → ${next.label}`);
    }
  };

  /* -------------------------------- exports ------------------------------- */
  const exportExcel = () => {
    const name = boardWorkbook({ tasks: filtered, sprints, projects, clients: collections.clients || [], title: activeSprint ? activeSprint.name.replace(/\s+/g, '-').toLowerCase() : 'project-board' });
    toast(`Board exported: ${name}`);
  };
  const exportPdf = () => {
    const doc = boardPDF({
      tasks: filtered,
      sprints,
      projects,
      settings,
      title: activeSprint ? activeSprint.name : 'Project board',
    });
    savePdf(doc, `DRIPS-board-${todayISO()}`);
    toast('Board PDF downloaded');
  };

  const completeSprint = (sprint) => {
    const cards = tasks.filter((t) => t.sprintId === sprint.id);
    const done = cards.filter((t) => t.column === 'done');
    const carry = cards.filter((t) => t.column !== 'done');
    updateItem('sprints', sprint.id, { status: 'completed' }, { debounce: 0 });
    toast(`Sprint completed — ${done.length} done, ${carry.length} carried to the backlog`);
    carry.forEach((t) => updateItem('tasks', t.id, { sprintId: '', column: 'backlog' }, { debounce: 0 }));
  };

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Project Board"
        subtitle="Agile kanban with sprints, story points, WIP limits, a calendar view and a burndown — exportable to Excel and PDF."
        icon={Kanban}
        actions={
          <>
            <Dropdown trigger={<Button variant="outline" icon={Download}>Export</Button>}>
              <MenuItem icon={Rows3} onClick={exportExcel}>
                Excel workbook (.xlsx)
              </MenuItem>
              <MenuItem icon={FileDown} onClick={exportPdf}>
                Board report (PDF)
              </MenuItem>
            </Dropdown>
            <Button variant="outline" icon={Target} onClick={() => setSprintModal(true)}>
              New sprint
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setTaskModal({})}>
              New card
            </Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Board view"
            value={view}
            onChange={(v) => {
              setView(v);
              if (v === 'calendar') params.set('view', 'calendar');
              else params.delete('view');
              setParams(params, { replace: true });
            }}
            options={[
              { value: 'board', label: 'Board', icon: Kanban },
              { value: 'calendar', label: 'Calendar', icon: CalendarIcon },
              { value: 'list', label: 'List', icon: ListChecks },
              { value: 'sprint', label: 'Sprint review', icon: TrendingDown },
            ]}
          />
        </div>
      </PageHeader>

      {/* filters */}
      <Card className="mb-4 flex flex-col gap-2.5 p-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search cards, labels, people…" className="lg:max-w-xs lg:flex-1" id="board-search" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} className="!w-auto !text-xs" aria-label="Sprint">
            <option value="all">All sprints</option>
            <option value="none">No sprint (backlog)</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="!w-auto !text-xs" aria-label="Project">
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="!w-auto !text-xs" aria-label="Assignee">
            <option value="all">Everyone</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select value={label} onChange={(e) => setLabel(e.target.value)} className="!w-auto !text-xs" aria-label="Label">
            <option value="all">All labels</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          {(q || sprintId !== 'all' || projectId !== 'all' || assignee !== 'all' || label !== 'all') && (
            <Button size="sm" variant="ghost" icon={Filter} onClick={() => { setQ(''); setSprintId('all'); setProjectId('all'); setAssignee('all'); setLabel('all'); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] lg:ml-auto">
          <span>{filtered.length} cards</span>
          <span aria-hidden>·</span>
          <span className="tnum">{stats.totalPoints} points</span>
          <span aria-hidden>·</span>
          <span className="tnum">{stats.donePoints} done</span>
        </div>
      </Card>

      {activeSprint && (
        <Card className="mb-4 pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {activeSprint.name}
                <StatusPill status={activeSprint.status || 'active'} />
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {activeSprint.goal} · {fmtDate(activeSprint.startDate, locale)} → {fmtDate(activeSprint.endDate, locale)} · capacity {activeSprint.capacity || 0} pts
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Progress className="w-40" value={stats.donePoints} max={Math.max(1, stats.totalPoints)} label="Sprint progress" tone="flag" />
              <Button size="sm" variant="outline" icon={Check} onClick={() => completeSprint(activeSprint)}>
                Complete sprint
              </Button>
            </div>
          </div>
        </Card>
      )}

      {view === 'board' && (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {COLUMNS.map((col) => {
            const cards = sortBy(filtered.filter((t) => (t.column || 'backlog') === col.id), (t) => t.order || 0);
            const points = sum(cards, (t) => Number(t.points) || 0);
            const limit = wipLimits[col.id];
            const overLimit = limit && cards.length > limit;
            return (
              <section
                key={col.id}
                aria-label={`${col.label} column, ${cards.length} cards`}
                className="kanban-col flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_2.5%,transparent)] transition-colors lg:w-auto"
                data-over={overColumn === col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverColumn(col.id);
                }}
                onDragLeave={() => setOverColumn((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverColumn(null);
                  const id = e.dataTransfer.getData('text/task-id') || dragging;
                  if (id) moveTask(id, col.id);
                  setDragging(null);
                }}
              >
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.tone }} aria-hidden />
                  <h2 className="text-sm font-bold">{col.label}</h2>
                  <span className="tnum chip">{cards.length}</span>
                  <span className="tnum ml-auto text-[0.7rem] text-[var(--text-muted)]">{points} pts</span>
                  <IconButton icon={Plus} label={`Add card to ${col.label}`} size="sm" onClick={() => setTaskModal({ column: col.id, sprintId: sprintId !== 'all' && sprintId !== 'none' ? sprintId : '', projectId: projectId !== 'all' ? projectId : '' })} />
                </header>
                {limit && (
                  <p className={cx('px-3 pb-1 text-[0.66rem] font-semibold', overLimit ? 'text-flag-700' : 'text-[var(--text-muted)]')}>
                    WIP limit {limit}
                    {overLimit && ` · ${cards.length - limit} over`}
                  </p>
                )}
                <ul className="flex-1 space-y-2 px-2 pb-2" role="list">
                  {cards.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      dragging={dragging === t.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task-id', t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragging(t.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverColumn(null);
                      }}
                      onDropBefore={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.dataTransfer.getData('text/task-id') || dragging;
                        if (id) moveTask(id, col.id, t.id);
                        setDragging(null);
                      }}
                      onOpen={() => setTaskModal(t)}
                      onNudge={(dir) => nudge(t, dir)}
                      onDelete={() => {
                        if (window.confirm(`Delete “${t.title}”?`)) {
                          removeItem('tasks', t.id);
                          toast('Card deleted');
                        }
                      }}
                      onToggleDone={() => moveTask(t.id, t.column === 'done' ? 'todo' : 'done')}
                      project={projectMap[t.projectId]}
                      client={clientMap[t.clientId]}
                    />
                  ))}
                  {cards.length === 0 && (
                    <li className="rounded-xl border border-dashed border-[var(--line)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                      Drop a card here
                    </li>
                  )}
                </ul>
                <div className="px-2 pb-2">
                  <QuickAdd
                    column={col.id}
                    onAdd={async (title) => {
                      await addItem('tasks', {
                        id: undefined,
                        title,
                        description: '',
                        column: col.id,
                        points: 0,
                        priority: 'medium',
                        assignee: settings?.business?.owner?.split(' ')[0] || 'Me',
                        labels: [],
                        projectId: projectId !== 'all' ? projectId : '',
                        sprintId: sprintId !== 'all' && sprintId !== 'none' ? sprintId : '',
                        dueDate: '',
                        order: cards.length,
                        subtasks: [],
                      });
                    }}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'calendar' && (
        <CalendarView
          tasks={filtered}
          date={calendarDate}
          onChangeDate={setCalendarDate}
          onOpenTask={setTaskModal}
          onMoveTask={(taskId, date) => {
            updateItem('tasks', taskId, { dueDate: date }, { debounce: 0 });
            toast('Due date updated');
          }}
          onAddTask={(date) => setTaskModal({ dueDate: date, column: 'todo' })}
          dragging={dragging}
          setDragging={setDragging}
          locale={locale}
        />
      )}

      {view === 'list' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Card</th>
                  <th scope="col">Column</th>
                  <th scope="col">Sprint</th>
                  <th scope="col">Project</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Labels</th>
                  <th scope="col" className="num">Pts</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Due</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortBy(filtered, (t) => COLUMNS.findIndex((c) => c.id === (t.column || 'backlog'))).map((t) => {
                  const sprint = sprints.find((s) => s.id === t.sprintId);
                  const late = t.dueDate && t.column !== 'done' && daysBetween(t.dueDate, todayISO()) > 0;
                  return (
                    <tr key={t.id}>
                      <td className="max-w-[18rem]">
                        <button type="button" className="block truncate text-left font-semibold hover:text-[var(--color-brand-600)]" onClick={() => setTaskModal(t)}>
                          {t.title}
                        </button>
                        {t.description && <span className="block truncate text-[0.7rem] text-[var(--text-muted)]">{t.description}</span>}
                      </td>
                      <td>
                        <Select value={t.column || 'backlog'} onChange={(e) => moveTask(t.id, e.target.value)} className="!w-auto !py-1 !text-xs" aria-label={`Column for ${t.title}`}>
                          {COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="max-w-[10rem] truncate text-xs">{sprint?.name || '—'}</td>
                      <td className="max-w-[10rem] truncate text-xs">{projectMap[t.projectId]?.name || '—'}</td>
                      <td className="whitespace-nowrap text-xs">{t.assignee || '—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(t.labels || []).map((l) => (
                            <span key={l} className="chip" style={{ borderColor: `${LABEL_COLORS[Math.abs(hash(l)) % LABEL_COLORS.length]}55`, color: LABEL_COLORS[Math.abs(hash(l)) % LABEL_COLORS.length] }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="num">{t.points || 0}</td>
                      <td>
                        <Pill tone={PRIORITY_TONE[t.priority] || 'neutral'}>{t.priority || 'medium'}</Pill>
                      </td>
                      <td className={cx('whitespace-nowrap text-xs', late && 'font-bold text-flag-700')}>{t.dueDate ? fmtDate(t.dueDate, locale) : '—'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <IconButton icon={MoreHorizontal} label={`Edit ${t.title}`} size="sm" onClick={() => setTaskModal(t)} />
                          <IconButton icon={Trash2} label={`Delete ${t.title}`} size="sm" onClick={() => { if (window.confirm(`Delete “${t.title}”?`)) removeItem('tasks', t.id); }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-4">
              <EmptyState icon={Kanban} title="No cards match" description="Adjust the filters or create a card." action={<Button variant="primary" icon={Plus} onClick={() => setTaskModal({})}>New card</Button>} />
            </div>
          )}
        </Card>
      )}

      {view === 'sprint' && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr] xl:items-start">
          <Card className="pad">
            <SectionTitle action={<Button size="sm" variant="outline" icon={Plus} onClick={() => setSprintModal(true)}>New sprint</Button>}>Sprints</SectionTitle>
            {sprints.length === 0 ? (
              <EmptyState className="border-0" icon={Target} title="No sprints yet" description="Create a sprint to group cards, set a goal and track the burndown." action={<Button variant="primary" icon={Plus} onClick={() => setSprintModal(true)}>Create sprint</Button>} />
            ) : (
              <ul className="space-y-2.5">
                {sprints.map((s) => {
                  const cards = tasks.filter((t) => t.sprintId === s.id);
                  const st = boardStats(cards, '');
                  const capacityPct = s.capacity ? (st.totalPoints / s.capacity) * 100 : 0;
                  return (
                    <li key={s.id} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold">{s.name}</p>
                        <div className="flex items-center gap-2">
                          <StatusPill status={s.status || 'planned'} />
                          <Button size="sm" variant="ghost" onClick={() => setSprintId(s.id)}>
                            View board
                          </Button>
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{s.goal}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <Progress value={st.totalPoints} max={Math.max(1, Number(s.capacity) || st.totalPoints)} label={`Capacity ${capacityPct > 100 ? '⚠ over' : ''}`} tone={capacityPct > 100 ? 'flag' : 'brand'} />
                        <Progress value={st.donePoints} max={Math.max(1, st.totalPoints)} label="Completed" tone="mint" />
                        <div className="text-xs text-[var(--text-muted)]">
                          <p>{fmtDate(s.startDate, locale)} → {fmtDate(s.endDate, locale)}</p>
                          <p className="tnum mt-1 font-semibold text-[var(--text)]">
                            {cards.length} cards · {st.totalPoints} pts · {st.donePoints} done
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle>Burndown {activeSprint ? `· ${activeSprint.name}` : ''}</SectionTitle>
              {burndown.length ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={burndown} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} labelFormatter={(d) => fmtDate(d, locale)} />
                      <Line type="monotone" dataKey="ideal" stroke="#8AA0C8" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Ideal" />
                      <Line type="monotone" dataKey="actual" stroke="#AE1C28" strokeWidth={2.5} dot={false} name="Remaining" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Select a sprint with start and end dates to see the burndown.</p>
              )}
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <KPI label="Velocity" value={`${round2(sum(sprints.filter((s) => s.status === 'completed'), (s) => sum(tasks.filter((t) => t.sprintId === s.id && t.column === 'done'), (t) => Number(t.points) || 0)) / Math.max(1, sprints.filter((s) => s.status === 'completed').length))} pts`} icon={TrendingDown} tone="brand" hint="Average per completed sprint" />
              <KPI label="Cycle risk" value={`${stats.overdue}`} icon={Flag} tone={stats.overdue ? 'flag' : 'mint'} hint="Cards past their due date" />
              <KPI label="Team load" value={`${stats.inProgress}`} icon={Users} tone="amber" hint="Cards in progress right now" />
            </div>

            <Card className="pad">
              <SectionTitle>Workload per person</SectionTitle>
              <ul className="space-y-2">
                {Object.entries(groupBy(filtered.filter((t) => t.column !== 'done'), (t) => t.assignee || 'Unassigned')).map(([name, list]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">{name}</span>
                      <span className="tnum text-[var(--text-muted)]">
                        {list.length} cards · {sum(list, (t) => Number(t.points) || 0)} pts
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                      <div className="h-full rounded-full bg-[var(--color-brand-600)]" style={{ width: `${Math.min(100, (sum(list, (t) => Number(t.points) || 0) / Math.max(1, stats.totalPoints)) * 100)}%` }} />
                    </div>
                  </li>
                ))}
                {filtered.filter((t) => t.column !== 'done').length === 0 && <li className="text-sm text-[var(--text-muted)]">Nothing open — everything is done. 🎉</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <TaskModal task={taskModal} onClose={() => setTaskModal(null)} />
      <SprintModal open={sprintModal} onClose={() => setSprintModal(false)} sprint={sprints.find((s) => s.id === sprintId)} />

      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        Drag cards between columns, or focus a card and use the ◀ ▶ buttons — the board is fully keyboard accessible.
        Exports: <button type="button" className="link" onClick={exportExcel}>Excel</button> ·{' '}
        <button type="button" className="link" onClick={exportPdf}>PDF</button> · estimated effort {stats.totalPoints} pts ≈{' '}
        {stats.totalPoints * hoursPerPoint} h ≈ {m(stats.totalPoints * hoursPerPoint * Number(settings?.defaults?.hourlyRate || 0))} (at {hoursPerPoint} h per point and your default rate)
      </p>
    </>
  );
}

const hash = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

/* --------------------------------- card ----------------------------------- */

function TaskCard({ task, dragging, onDragStart, onDragEnd, onDropBefore, onOpen, onNudge, onDelete, onToggleDone, project, client }) {
  const late = task.dueDate && task.column !== 'done' && daysBetween(task.dueDate, todayISO()) > 0;
  const dueSoon = task.dueDate && task.column !== 'done' && !late && daysBetween(task.dueDate, todayISO()) <= 2;
  const subDone = (task.subtasks || []).filter((s) => s.done).length;

  return (
    <li
      role="listitem"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropBefore}
      data-dragging={dragging}
      className="kanban-card group"
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open card ${task.title}`}>
          <p className="text-[0.82rem] font-semibold leading-snug">{task.title}</p>
          {task.description && <p className="mt-1 line-clamp-2 text-[0.7rem] leading-snug text-[var(--text-muted)]">{task.description}</p>}
        </button>
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>

      {(task.labels || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l} className="chip !px-1.5 !py-0.5 !text-[0.62rem]" style={{ color: LABEL_COLORS[Math.abs(hash(l)) % LABEL_COLORS.length], borderColor: `${LABEL_COLORS[Math.abs(hash(l)) % LABEL_COLORS.length]}55` }}>
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.68rem]">
        {task.points ? <span className="chip !px-1.5 !py-0.5 tnum">{task.points} pts</span> : null}
        {task.priority && task.priority !== 'medium' && <Pill tone={PRIORITY_TONE[task.priority]}>{task.priority}</Pill>}
        {task.dueDate && (
          <span className={cx('chip !px-1.5 !py-0.5', late ? 'chip-red' : dueSoon ? 'chip-amber' : '')}>
            {late ? <Flag className="h-2.5 w-2.5" aria-hidden /> : null}
            {fmtDate(task.dueDate, 'nl-NL', { day: '2-digit', month: 'short' })}
          </span>
        )}
        {(task.subtasks || []).length > 0 && (
          <span className="chip !px-1.5 !py-0.5">
            <ListChecks className="h-2.5 w-2.5" aria-hidden />
            {subDone}/{task.subtasks.length}
          </span>
        )}
        {project && <span className="chip !px-1.5 !py-0.5" style={{ borderColor: `${project.color}55`, color: project.color }}>{project.name.split(' ')[0]}</span>}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-[var(--line)] pt-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-[0.55rem] font-bold text-white" aria-hidden>
            {(task.assignee || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[0.68rem] text-[var(--text-muted)]">{task.assignee || 'Unassigned'}</span>
          {client && <span className="truncate text-[0.62rem] text-[var(--text-muted)]">· {client.company || client.name}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" className="btn btn-ghost !px-1 !py-0.5" onClick={() => onNudge(-1)} aria-label={`Move ${task.title} one column left`} title="Move left">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className="btn btn-ghost !px-1 !py-0.5" onClick={() => onNudge(1)} aria-label={`Move ${task.title} one column right`} title="Move right">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          <Dropdown
            trigger={<IconButton icon={MoreHorizontal} label={`More actions for ${task.title}`} size="sm" className="!px-1 !py-0.5" />}
          >
            <MenuItem onClick={onOpen}>Open card</MenuItem>
            <MenuItem icon={Check} onClick={onToggleDone}>
              {task.column === 'done' ? 'Reopen' : 'Mark done'}
            </MenuItem>
            {COLUMNS.filter((c) => c.id !== task.column).map((c) => (
              <MenuItem key={c.id} onClick={() => onNudge(COLUMNS.findIndex((x) => x.id === c.id) - COLUMNS.findIndex((x) => x.id === (task.column || 'backlog')))}>
                Move to {c.label}
              </MenuItem>
            ))}
            <MenuItem icon={Trash2} tone="danger" onClick={onDelete}>
              Delete card
            </MenuItem>
          </Dropdown>
        </div>
      </div>
    </li>
  );
}

function QuickAdd({ column, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  if (!open)
    return (
      <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]" onClick={() => setOpen(true)}>
        + Add a card
      </button>
    );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await onAdd(title.trim());
        setTitle('');
        inputRef.current?.focus();
      }}
      className="rounded-xl border border-[var(--line)] bg-[var(--surface-card)] p-2"
    >
      <textarea
        ref={inputRef}
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form.requestSubmit();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={`Add a card to ${column}…`}
        aria-label={`New card in ${column}`}
        className="w-full resize-none bg-transparent text-[0.82rem] outline-none placeholder:text-[var(--text-muted)]"
      />
      <div className="mt-1 flex items-center justify-between">
        <Button type="submit" size="sm" variant="primary">
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setTitle(''); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------- calendar --------------------------------- */

function CalendarView({ tasks, date, onChangeDate, onOpenTask, onMoveTask, onAddTask, dragging, setDragging, locale }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart.toISOString().slice(0, 10), i).toISOString().slice(0, 10));
  const byDay = groupBy(tasks.filter((t) => t.dueDate), (t) => t.dueDate);
  const today = todayISO();

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] p-3">
        <div className="flex items-center gap-1.5">
          <IconButton icon={ChevronLeft} label="Previous month" size="sm" onClick={() => onChangeDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))} />
          <h2 className="min-w-[10rem] text-center text-sm font-bold capitalize">
            {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)}
          </h2>
          <IconButton icon={ChevronRight} label="Next month" size="sm" onClick={() => onChangeDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))} />
          <Button size="sm" variant="ghost" onClick={() => onChangeDate(new Date())}>
            Today
          </Button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {tasks.filter((t) => t.dueDate).length} dated cards · drag a card onto a day to reschedule ·{' '}
          <button type="button" className="link" onClick={() => onAddTask(today)}>
            add a card
          </button>
        </p>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_2%,transparent)] text-center text-[0.68rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = new Date(d).getMonth() === date.getMonth();
          const dayTasks = byDay[d] || [];
          return (
            <div
              key={d}
              className={cx(
                'min-h-[6.5rem] border-b border-r border-[var(--line)] p-1.5 transition-colors last:border-r-0',
                !inMonth && 'bg-[color-mix(in_srgb,var(--text)_2%,transparent)] opacity-60',
                d === today && 'bg-[color-mix(in_srgb,var(--color-flag-700)_6%,transparent)]',
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/task-id') || dragging;
                if (id) onMoveTask(id, d);
                setDragging(null);
              }}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={cx('tnum text-[0.7rem] font-bold', d === today ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-flag-700)] text-white' : 'text-[var(--text-muted)]')}>
                  {Number(d.slice(8))}
                </span>
                <button
                  type="button"
                  onClick={() => onAddTask(d)}
                  className="rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--color-brand-600)] focus:opacity-100 hover:opacity-100"
                  aria-label={`Add a card on ${fmtDate(d, locale)}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <ul className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task-id', t.id);
                        setDragging(t.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => onOpenTask(t)}
                      className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[0.66rem] font-semibold leading-tight text-white"
                      style={{ background: COLUMNS.find((c) => c.id === (t.column || 'backlog'))?.tone }}
                      title={`${t.title} · ${COLUMNS.find((c) => c.id === (t.column || 'backlog'))?.label}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {t.points ? <span className="tnum shrink-0 opacity-80">{t.points}</span> : null}
                    </button>
                  </li>
                ))}
                {dayTasks.length > 3 && <li className="px-1 text-[0.62rem] text-[var(--text-muted)]">+{dayTasks.length - 3} more</li>}
              </ul>
              {i === 41 && null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] p-3 text-xs text-[var(--text-muted)]">
        {COLUMNS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.tone }} aria-hidden />
            {c.label}
          </span>
        ))}
        <span className="ml-auto">Week of {fmtDate(weekStart().toISOString().slice(0, 10), locale)}: {tasks.filter((t) => t.dueDate && daysBetween(t.dueDate, weekStart().toISOString().slice(0, 10)) >= 0 && daysBetween(t.dueDate, weekStart().toISOString().slice(0, 10)) < 7).length} due</span>
      </div>
    </Card>
  );
}

/* --------------------------------- modals --------------------------------- */

function TaskModal({ task, onClose }) {
  const { collections, addItem, updateItem, removeItem, toast, settings } = useApp();
  const open = !!task;
  const editing = !!task?.id;
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    if (task?.id) setForm({ ...task, subtasks: task.subtasks || [] });
    else
      setForm({
        title: '',
        description: '',
        column: 'todo',
        points: 3,
        priority: 'medium',
        assignee: settings?.business?.owner?.split(' ')[0] || 'Me',
        labels: [],
        projectId: '',
        sprintId: '',
        clientId: '',
        dueDate: '',
        subtasks: [],
        ...(task || {}),
      });
  }, [open, task?.id]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (editing) {
      await updateItem('tasks', form.id, form, { debounce: 0 });
      toast('Card updated');
    } else {
      await addItem('tasks', form);
      toast('Card added to the board');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit card' : 'New card'}
      description="Story points feed the sprint burndown; the due date puts the card on the calendar."
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              icon={Trash2}
              className="mr-auto"
              onClick={() => {
                if (window.confirm(`Delete “${form.title}”?`)) {
                  removeItem('tasks', form.id);
                  toast('Card deleted');
                  onClose();
                }
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Check} onClick={save} disabled={!form.title}>
            {editing ? 'Save card' : 'Add card'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2" required>
          <Input autoFocus value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Hi-fi signup screens" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Acceptance criteria, links, context…" />
        </Field>
        <Field label="Column">
          <Select value={form.column || 'todo'} onChange={(e) => set('column', e.target.value)}>
            {COLUMNS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Story points">
          <Select value={String(form.points ?? 0)} onChange={(e) => set('points', Number(e.target.value))}>
            {[0, 1, 2, 3, 5, 8, 13, 21].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority || 'medium'} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee">
          <Input value={form.assignee || ''} onChange={(e) => set('assignee', e.target.value)} list="assignee-options" />
          <datalist id="assignee-options">
            {[...new Set((collections.tasks || []).map((t) => t.assignee).filter(Boolean))].map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="Sprint">
          <Select value={form.sprintId || ''} onChange={(e) => set('sprintId', e.target.value)}>
            <option value="">— Backlog (no sprint) —</option>
            {(collections.sprints || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Project">
          <Select value={form.projectId || ''} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">— None —</option>
            {(collections.projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client">
          <Select value={form.clientId || ''} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">— None —</option>
            {(collections.clients || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.company || c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Labels" className="sm:col-span-2" hint="Comma separated, e.g. ui, a11y, research">
          <Input value={(form.labels || []).join(', ')} onChange={(e) => set('labels', e.target.value.split(',').map((l) => l.trim()).filter(Boolean))} placeholder="ui, a11y" />
        </Field>
      </div>

      <div className="mt-4">
        <SectionTitle
          action={
            <Button size="sm" variant="outline" icon={Plus} onClick={() => set('subtasks', [...(form.subtasks || []), { id: uid('st'), title: '', done: false }])}>
              Add checklist item
            </Button>
          }
        >
          Checklist
        </SectionTitle>
        {(form.subtasks || []).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No checklist items yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {(form.subtasks || []).map((s, i) => (
              <li key={s.id || i} className="flex items-center gap-2">
                <Checkbox
                  checked={s.done}
                  onChange={(v) => set('subtasks', form.subtasks.map((x, xi) => (xi === i ? { ...x, done: v } : x)))}
                  label=""
                />
                <Input
                  value={s.title}
                  onChange={(e) => set('subtasks', form.subtasks.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
                  placeholder="Subtask"
                  aria-label={`Checklist item ${i + 1}`}
                  className={cx(s.done && 'line-through opacity-60')}
                />
                <IconButton icon={Trash2} label={`Remove checklist item ${i + 1}`} size="sm" onClick={() => set('subtasks', form.subtasks.filter((_, xi) => xi !== i))} />
              </li>
            ))}
          </ul>
        )}
        {(form.subtasks || []).length > 0 && (
          <Progress className="mt-3" value={form.subtasks.filter((s) => s.done).length} max={form.subtasks.length} label="Checklist" tone="mint" />
        )}
      </div>
    </Modal>
  );
}

function SprintModal({ open, onClose, sprint }) {
  const { addItem, updateItem, collections, toast } = useApp();
  const [form, setForm] = useState({});

  useMemo(() => {
    if (!open) return;
    setForm(
      sprint?.id
        ? { ...sprint }
        : {
            name: `Sprint ${(collections.sprints || []).length + 1}`,
            goal: '',
            projectId: (collections.projects || [])[0]?.id || '',
            startDate: todayISO(),
            endDate: addDays(todayISO(), 13).toISOString().slice(0, 10),
            capacity: 40,
            status: 'planned',
          },
    );
  }, [open, sprint?.id]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sprint?.id ? `Edit ${sprint.name}` : 'Plan a sprint'}
      description="Two weeks is the classic cadence — set a goal the team can rally around."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            onClick={async () => {
              if (sprint?.id) {
                await updateItem('sprints', sprint.id, form, { debounce: 0 });
                toast('Sprint updated');
              } else {
                await addItem('sprints', form);
                toast('Sprint created — drag cards into it from the board');
              }
              onClose();
            }}
          >
            {sprint?.id ? 'Save sprint' : 'Create sprint'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sprint name" className="sm:col-span-2" required>
          <Input autoFocus value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Sprint 12 — Design system" />
        </Field>
        <Field label="Sprint goal" className="sm:col-span-2">
          <Textarea rows={2} value={form.goal || ''} onChange={(e) => set('goal', e.target.value)} placeholder="Ship tokens, buttons and the data table to Storybook" />
        </Field>
        <Field label="Project">
          <Select value={form.projectId || ''} onChange={(e) => set('projectId', e.target.value)}>
            <option value="">— No project —</option>
            {(collections.projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status || 'planned'} onChange={(e) => set('status', e.target.value)}>
            {['planned', 'active', 'completed'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date">
          <Input type="date" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="End date">
          <Input type="date" value={form.endDate || ''} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
        <Field label="Capacity (story points)" hint="Used for the velocity and over-commitment warnings.">
          <Input type="number" min="0" step="1" value={form.capacity ?? 40} onChange={(e) => set('capacity', Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  );
}
