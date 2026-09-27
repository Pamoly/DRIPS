import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { api, streamChat } from '../lib/api';
import type {
  AgentMessage,
  Analysis,
  AuditEvent,
  ChatEvent,
  Finding,
  LearningPayload,
  Overview,
  Patch,
  Review,
  Run,
  Severity,
  StepEvent,
  WorkspaceFile,
} from '../types';

export interface TraceEntry {
  agent: string;
  action: string;
  detail: string;
  status: 'running' | 'done' | 'failed';
  xp?: number;
}

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  headline?: string;
  markdown?: string;
  data?: Record<string, any>;
  followUps?: string[];
  streaming?: boolean;
}

export interface Toast {
  id: string;
  kind: 'ok' | 'warn' | 'error' | 'info';
  title: string;
  body?: string;
}

interface State {
  ready: boolean;
  error: string | null;
  files: WorkspaceFile[];
  activePath: string | null;
  analysis: Analysis | null;
  dirty: Record<string, string>;
  overview: Overview | null;
  patches: Patch[];
  reviews: Review[];
  runs: Run[];
  audit: AuditEvent[];
  learning: LearningPayload | null;
  autonomy: string;
  reasoning: { provider: string; has_llm: boolean; models?: Record<string, string> } | null;
  version: string;
  messages: ChatMessageView[];
  trace: TraceEntry[];
  planning: TraceEntry[];
  streaming: boolean;
  sessionId: string | null;
  layout: {
    explorerWidth: number;
    dockWidth: number;
    editorTab: 'code' | 'health' | 'run';
    dockTab: 'mentor' | 'fixes' | 'review' | 'learn' | 'history';
    dockOpen: boolean;
    explorerOpen: boolean;
    focusLine: number | null;
  };
  toasts: Toast[];
  lastRun: Run | null;
}

type Action =
  | { type: 'boot'; payload: Partial<State> }
  | { type: 'error'; message: string }
  | { type: 'files'; files: WorkspaceFile[] }
  | { type: 'active'; path: string }
  | { type: 'analysis'; analysis: Analysis }
  | { type: 'edit'; path: string; content: string }
  | { type: 'saved'; path: string }
  | { type: 'finishStreaming' }
  | { type: 'overview'; overview: Overview }
  | { type: 'patches'; patches: Patch[] }
  | { type: 'upsertPatch'; patch: Patch }
  | { type: 'reviews'; reviews: Review[] }
  | { type: 'upsertReview'; review: Review }
  | { type: 'runs'; runs: Run[] }
  | { type: 'audit'; events: AuditEvent[] }
  | { type: 'learning'; learning: LearningPayload }
  | { type: 'autonomy'; mode: string; reasoning?: State['reasoning'] }
  | { type: 'message'; message: ChatMessageView }
  | { type: 'appendToken'; text: string }
  | { type: 'patchMessage'; patch: Patch }
  | { type: 'trace'; entry: TraceEntry }
  | { type: 'resetTrace' }
  | { type: 'planning'; entries: TraceEntry[] }
  | { type: 'streaming'; value: boolean }
  | { type: 'session'; id: string }
  | { type: 'layout'; patch: Partial<State['layout']> }
  | { type: 'toast'; toast: Toast }
  | { type: 'dropToast'; id: string }
  | { type: 'lastRun'; run: Run | null };

const initialState: State = {
  ready: false,
  error: null,
  files: [],
  activePath: null,
  analysis: null,
  dirty: {},
  overview: null,
  patches: [],
  reviews: [],
  runs: [],
  audit: [],
  learning: null,
  autonomy: 'supervised',
  reasoning: null,
  version: '1.0.0',
  messages: [],
  trace: [],
  planning: [],
  streaming: false,
  sessionId: null,
  layout: {
    explorerWidth: 280,
    dockWidth: 430,
    editorTab: 'code',
    dockTab: 'mentor',
    dockOpen: true,
    explorerOpen: true,
    focusLine: null,
  },
  toasts: [],
  lastRun: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'boot':
      return { ...state, ...action.payload, ready: true };
    case 'error':
      return { ...state, error: action.message };
    case 'files':
      return { ...state, files: action.files };
    case 'active':
      return { ...state, activePath: action.path, analysis: null };
    case 'analysis':
      return { ...state, analysis: action.analysis };
    case 'edit': {
      // Monaco fires onChange when a *different file* is loaded into it, so a value that
      // matches what is on disk is not a real edit — otherwise every file switch would
      // mark the newly opened file as unsaved.
      const file = state.files.find((candidate) => candidate.path === action.path);
      if (file && action.content === file.content) {
        const dirty = { ...state.dirty };
        delete dirty[action.path];
        return { ...state, dirty };
      }
      return { ...state, dirty: { ...state.dirty, [action.path]: action.content } };
    }
    case 'saved': {
      const dirty = { ...state.dirty };
      delete dirty[action.path];
      return { ...state, dirty };
    }
    case 'finishStreaming': {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && last.streaming) {
        messages[messages.length - 1] = { ...last, streaming: false };
      }
      return { ...state, streaming: false, messages };
    }
    case 'overview':
      return { ...state, overview: action.overview };
    case 'patches':
      return { ...state, patches: action.patches };
    case 'upsertPatch': {
      const others = state.patches.filter((patch) => patch.id !== action.patch.id);
      return { ...state, patches: [action.patch, ...others] };
    }
    case 'reviews':
      return { ...state, reviews: action.reviews };
    case 'upsertReview': {
      const others = state.reviews.filter((review) => review.id !== action.review.id);
      return { ...state, reviews: [action.review, ...others] };
    }
    case 'runs':
      return { ...state, runs: action.runs };
    case 'audit':
      return { ...state, audit: action.events };
    case 'learning':
      return { ...state, learning: action.learning };
    case 'autonomy':
      return { ...state, autonomy: action.mode, reasoning: action.reasoning ?? state.reasoning };
    case 'message':
      return { ...state, messages: [...state.messages, action.message] };
    case 'appendToken': {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && last.streaming) {
        messages[messages.length - 1] = { ...last, content: last.content + action.text };
      } else {
        // the live summary bubble is created on the first token, so it always sits
        // *after* the agent blocks instead of above them
        messages.push({ id: `live-${Date.now()}`, role: 'assistant', content: action.text, streaming: true });
      }
      return { ...state, messages };
    }
    case 'trace': {
      const trace = [...state.trace];
      const index = trace.findIndex(
        (entry) => entry.agent === action.entry.agent && entry.action === action.entry.action,
      );
      if (index >= 0) trace[index] = { ...trace[index], ...action.entry };
      else trace.push(action.entry);
      return { ...state, trace };
    }
    case 'planning':
      return { ...state, planning: action.entries, trace: [] };
    case 'resetTrace':
      return { ...state, trace: [], planning: [] };
    case 'streaming':
      return { ...state, streaming: action.value };
    case 'session':
      return { ...state, sessionId: action.id };
    case 'layout':
      return { ...state, layout: { ...state.layout, ...action.patch } };
    case 'toast':
      return { ...state, toasts: [...state.toasts.filter((t) => t.id !== action.toast.id), action.toast] };
    case 'dropToast':
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
    case 'lastRun':
      return { ...state, lastRun: action.run };
    default:
      return state;
  }
}

interface WorkspaceValue extends State {
  activeFile: WorkspaceFile | null;
  activeContent: string;
  dirty: Record<string, string>;
  refreshAll: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  editContent: (content: string) => void;
  saveActive: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  analyzeActive: () => Promise<void>;
  askMentor: (message: string, extra?: { traceback?: string; source?: string; language?: string }) => Promise<void>;
  stopStreaming: () => void;
  proposeFixes: () => Promise<void>;
  decidePatch: (id: string, approve: boolean, note?: string) => Promise<void>;
  applyPatch: (id: string) => Promise<void>;
  revertPatch: (id: string) => Promise<void>;
  createReview: () => Promise<void>;
  decideReview: (id: string, decision: string, note?: string) => Promise<void>;
  commentReview: (id: string, body: string, line?: number, kind?: string) => Promise<void>;
  runActive: () => Promise<void>;
  setAutonomy: (mode: string) => Promise<void>;
  completeLesson: (id: string) => Promise<void>;
  resetWorkspace: () => Promise<void>;
  setLayout: (patch: Partial<State['layout']>) => void;
  jumpToLine: (line: number) => void;
  toast: (toast: Omit<Toast, 'id'>) => void;
  clearToasts: () => void;
  findings: Finding[];
  severityCounts: Record<Severity, number>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const toast = useCallback((payload: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    dispatch({ type: 'toast', toast: { id, ...payload } });
    setTimeout(() => dispatch({ type: 'dropToast', id }), payload.kind === 'error' ? 9000 : 5200);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [workspace, patches, reviews, learning, audit, runs] = await Promise.all([
        api.workspace(),
        api.patches(),
        api.reviews(),
        api.learning(),
        api.audit(40),
        api.runs(),
      ]);
      dispatch({
        type: 'boot',
        payload: {
          files: workspace.files,
          overview: workspace.overview,
          autonomy: workspace.autonomy,
          reasoning: workspace.reasoning,
          version: workspace.version,
          patches: patches.patches,
          reviews: reviews.reviews,
          learning,
          audit: audit.events,
          runs: runs.runs,
        },
      });
      const first = stateRef.current.activePath ?? workspace.files[0]?.path ?? null;
      if (first) await openFile(first, true);
    } catch (error) {
      dispatch({ type: 'error', message: (error as Error).message });
    }
  }, []);

  const openFile = useCallback(async (path: string, silent = false) => {
    dispatch({ type: 'active', path });
    try {
      const payload = await api.file(path);
      dispatch({ type: 'analysis', analysis: payload.analysis });
      if (!silent) dispatch({ type: 'layout', patch: { editorTab: 'code' } });
    } catch (error) {
      toast({ kind: 'error', title: 'Could not open the file', body: (error as Error).message });
    }
  }, [toast]);

  const analyzeActive = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    try {
      const payload = await api.analyze(path);
      dispatch({ type: 'analysis', analysis: payload.analysis });
      dispatch({ type: 'layout', patch: { editorTab: 'health' } });
      toast({
        kind: 'ok',
        title: `Health ${payload.analysis.health_score}/100 (${payload.analysis.grade})`,
        body: payload.summary,
      });
      await Promise.all([refreshQuiet()]);
    } catch (error) {
      toast({ kind: 'error', title: 'Analysis failed', body: (error as Error).message });
    }
  }, [toast]);

  const refreshQuiet = useCallback(async () => {
    const [files, patches, reviews, learning, audit, overview] = await Promise.all([
      api.files(),
      api.patches(),
      api.reviews(),
      api.learning(),
      api.audit(40),
      api.overview().catch(() => null),
    ]);
    dispatch({ type: 'files', files: files.files });
    dispatch({ type: 'patches', patches: patches.patches });
    dispatch({ type: 'reviews', reviews: reviews.reviews });
    dispatch({ type: 'learning', learning });
    dispatch({ type: 'audit', events: audit.events });
    if (overview) dispatch({ type: 'overview', overview });
  }, []);

  const saveActive = useCallback(async () => {
    const { activePath, dirty } = stateRef.current;
    if (!activePath) return;
    const content = dirty[activePath];
    if (content === undefined) return;
    try {
      const payload = await api.saveFile(activePath, content);
      dispatch({ type: 'analysis', analysis: payload.analysis });
      dispatch({ type: 'saved', path: activePath });
      toast({ kind: 'ok', title: 'Saved', body: `Health now ${payload.analysis.health_score}/100` });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Save failed', body: (error as Error).message });
    }
  }, [toast, refreshQuiet]);

  const createFile = useCallback(async (path: string) => {
    try {
      const payload = await api.createFile(path);
      toast({ kind: 'ok', title: `Created ${payload.file.path}` });
      await refreshQuiet();
      await openFile(payload.file.path);
    } catch (error) {
      toast({ kind: 'error', title: 'Could not create the file', body: (error as Error).message });
    }
  }, [openFile, refreshQuiet, toast]);

  const deleteFile = useCallback(async (path: string) => {
    try {
      await api.deleteFile(path);
      toast({ kind: 'info', title: `Deleted ${path}` });
      await refreshQuiet();
      const next = stateRef.current.files.find((file) => file.path !== path);
      if (next) await openFile(next.path, true);
    } catch (error) {
      toast({ kind: 'error', title: 'Delete failed', body: (error as Error).message });
    }
  }, [openFile, refreshQuiet, toast]);

  const handleEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'session':
        dispatch({ type: 'session', id: event.session_id });
        break;
      case 'plan':
        dispatch({
          type: 'planning',
          entries: (event.steps ?? []).map((step: StepEvent) => ({
            agent: step.agent,
            action: step.action,
            detail: step.detail,
            status: 'pending' as const,
          })),
        });
        break;
      case 'step':
        dispatch({
          type: 'trace',
          entry: {
            agent: event.agent,
            action: event.action,
            detail: event.detail,
            status: event.status,
            xp: event.xp,
          },
        });
        break;
      case 'analysis':
        dispatch({ type: 'analysis', analysis: event.analysis });
        break;
      case 'patch':
        dispatch({ type: 'upsertPatch', patch: event.patch });
        dispatch({ type: 'layout', patch: { dockTab: 'fixes' } });
        break;
      case 'review':
        dispatch({ type: 'upsertReview', review: event.review });
        break;
      case 'file':
        dispatch({
          type: 'files',
          files: stateRef.current.files.map((file) =>
            file.path === event.file.path ? { ...file, ...event.file } : file,
          ),
        });
        break;
      case 'autopilot':
        toast({ kind: 'info', title: 'Autopilot applied a safe fix', body: event.applied?.title });
        break;
      case 'message': {
        const message = event.message as AgentMessage & { id: string };
        dispatch({
          type: 'message',
          message: {
            id: message.id ?? `${Date.now()}`,
            role: 'assistant',
            content: '',
            agent: message.agent,
            headline: message.headline,
            markdown: message.markdown,
            data: message.data,
            followUps: message.follow_ups,
          },
        });
        break;
      }
      case 'token':
        dispatch({ type: 'appendToken', text: event.text });
        break;
      case 'error':
        toast({ kind: 'error', title: 'The assistant hit a problem', body: event.error });
        break;
      default:
        break;
    }
  }, [toast]);

  const askMentor = useCallback(
    async (message: string, extra: { traceback?: string; source?: string; language?: string } = {}) => {
      const { activePath, sessionId } = stateRef.current;
      const activeContent = stateRef.current.activePath
        ? stateRef.current.dirty[stateRef.current.activePath] ??
          stateRef.current.files.find((file) => file.path === stateRef.current.activePath)?.content ??
          ''
        : '';
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({
        type: 'message',
        message: { id: `u-${Date.now()}`, role: 'user', content: message },
      });
      dispatch({ type: 'streaming', value: true });
      dispatch({ type: 'layout', patch: { dockTab: 'mentor', dockOpen: true } });

      try {
        await streamChat(
          {
            message,
            file: activePath,
            traceback: extra.traceback,
            source: extra.source ?? activeContent,
            language: extra.language,
            session_id: sessionId ?? undefined,
          },
          handleEvent,
          controller.signal,
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast({ kind: 'error', title: 'Streaming interrupted', body: (error as Error).message });
        }
      } finally {
        dispatch({ type: 'finishStreaming' });
        await refreshQuiet();
      }
    },
    [handleEvent, refreshQuiet, toast],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'finishStreaming' });
  }, []);

  const proposeFixes = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    try {
      const payload = await api.propose(path);
      dispatch({ type: 'patches', patches: await api.patches().then((result) => result.patches) });
      dispatch({ type: 'layout', patch: { dockTab: 'fixes', dockOpen: true } });
      toast({
        kind: payload.patches.length ? 'ok' : 'info',
        title: payload.patches.length ? `${payload.patches.length} patch(es) ready` : 'Nothing to fix automatically',
        body: payload.message,
      });
    } catch (error) {
      toast({ kind: 'error', title: 'Could not propose fixes', body: (error as Error).message });
    }
  }, [toast]);

  const decidePatch = useCallback(async (id: string, approve: boolean, note = '') => {
    try {
      const payload = await api.decidePatch(id, approve, note);
      dispatch({ type: 'upsertPatch', patch: payload.patch });
      toast({
        kind: approve ? 'ok' : 'info',
        title: approve ? 'Patch approved' : 'Patch rejected',
        body: approve ? 'Read the diff once more, then apply it to the file.' : 'Your note was recorded in the audit trail.',
      });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Decision failed', body: (error as Error).message });
    }
  }, [refreshQuiet, toast]);

  const applyPatch = useCallback(async (id: string) => {
    try {
      const payload = await api.applyPatch(id);
      dispatch({ type: 'upsertPatch', patch: payload.patch });
      dispatch({ type: 'analysis', analysis: payload.analysis });
      toast({
        kind: 'ok',
        title: 'Applied to the file',
        body: `Health is now ${payload.analysis.health_score}/100. The change is in the audit trail and can be reverted.`,
      });
      await refreshQuiet();
      await openFile(payload.file.path, true);
    } catch (error) {
      toast({ kind: 'error', title: 'Could not apply', body: (error as Error).message });
    }
  }, [openFile, refreshQuiet, toast]);

  const revertPatch = useCallback(async (id: string) => {
    try {
      const payload = await api.revertPatch(id);
      dispatch({ type: 'upsertPatch', patch: payload.patch });
      dispatch({ type: 'analysis', analysis: payload.analysis });
      toast({ kind: 'info', title: 'Reverted', body: 'The file is back to its previous content.' });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Could not revert', body: (error as Error).message });
    }
  }, [refreshQuiet, toast]);

  const createReview = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    try {
      const payload = await api.createReview(path);
      dispatch({ type: 'upsertReview', review: payload.review });
      dispatch({ type: 'layout', patch: { dockTab: 'review', dockOpen: true } });
      toast({ kind: 'ok', title: `Review: ${payload.recommendation}`, body: 'Checklist and comments are ready for your decision.' });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Could not create the review', body: (error as Error).message });
    }
  }, [refreshQuiet, toast]);

  const decideReview = useCallback(async (id: string, decision: string, note = '') => {
    try {
      const payload = await api.decideReview(id, decision, note);
      dispatch({ type: 'upsertReview', review: payload.review });
      toast({ kind: 'ok', title: `Review ${payload.review.status}`, body: 'The decision is recorded with your name and note.' });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Decision failed', body: (error as Error).message });
    }
  }, [refreshQuiet, toast]);

  const commentReview = useCallback(async (id: string, body: string, line = 1, kind = 'comment') => {
    try {
      const payload = await api.commentReview(id, body, line, kind);
      dispatch({ type: 'upsertReview', review: payload.review });
    } catch (error) {
      toast({ kind: 'error', title: 'Comment failed', body: (error as Error).message });
    }
  }, [toast]);

  const runActive = useCallback(async () => {
    const path = stateRef.current.activePath;
    if (!path) return;
    dispatch({ type: 'layout', patch: { editorTab: 'run' } });
    try {
      const payload = await api.run(path);
      dispatch({ type: 'lastRun', run: payload.run });
      if (payload.patches?.length) {
        for (const patch of payload.patches) dispatch({ type: 'upsertPatch', patch });
      }
      toast({
        kind: payload.run.exit_code === 0 ? 'ok' : 'warn',
        title: payload.run.exit_code === 0 ? `Ran in ${payload.run.duration_ms.toFixed(0)} ms` : `Exit code ${payload.run.exit_code}`,
        body: payload.run.exit_code === 0 ? 'Output is in the Run tab.' : payload.diagnosis?.headline,
      });
      await refreshQuiet();
    } catch (error) {
      toast({ kind: 'error', title: 'Run failed', body: (error as Error).message });
    }
  }, [refreshQuiet, toast]);

  const setAutonomy = useCallback(async (mode: string) => {
    try {
      const payload = await api.setAutonomy(mode);
      dispatch({ type: 'autonomy', mode: payload.autonomy });
      toast({ kind: 'info', title: `Autonomy: ${payload.autonomy}`, body: payload.explanation });
    } catch (error) {
      toast({ kind: 'error', title: 'Could not change autonomy', body: (error as Error).message });
    }
  }, [toast]);

  const completeLesson = useCallback(async (id: string) => {
    try {
      const payload = await api.completeLesson(id);
      toast({ kind: 'ok', title: `Lesson complete — ${payload.learner.xp} XP`, body: `Level ${payload.level.n}: ${payload.level.title}` });
      const learning = await api.learning();
      dispatch({ type: 'learning', learning });
    } catch (error) {
      toast({ kind: 'error', title: 'Could not save progress', body: (error as Error).message });
    }
  }, [toast]);

  const resetWorkspace = useCallback(async () => {
    try {
      await api.reset();
      toast({ kind: 'info', title: 'Workspace restored to the sample files' });
      await refreshQuiet();
      const files = await api.files();
      if (files.files[0]) await openFile(files.files[0].path, true);
    } catch (error) {
      toast({ kind: 'error', title: 'Reset failed', body: (error as Error).message });
    }
  }, [openFile, refreshQuiet, toast]);

  const setLayout = useCallback((patch: Partial<State['layout']>) => {
    dispatch({ type: 'layout', patch });
  }, []);

  const jumpToLine = useCallback((line: number) => {
    dispatch({ type: 'layout', patch: { editorTab: 'code', focusLine: line } });
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const activeFile = useMemo(
    () => state.files.find((file) => file.path === state.activePath) ?? null,
    [state.files, state.activePath],
  );

  const activeContent = state.activePath
    ? state.dirty[state.activePath] ?? activeFile?.content ?? ''
    : '';

  const findings = state.analysis?.findings ?? [];

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, major: 0, minor: 0, info: 0 };
    for (const finding of findings) counts[finding.severity] += 1;
    return counts;
  }, [findings]);

  const value: WorkspaceValue = {
    ...state,
    activeFile,
    activeContent,
    refreshAll,
    openFile,
    editContent: (content: string) => {
      if (state.activePath) dispatch({ type: 'edit', path: state.activePath, content });
    },
    saveActive,
    createFile,
    deleteFile,
    analyzeActive,
    askMentor,
    stopStreaming,
    proposeFixes,
    decidePatch,
    applyPatch,
    revertPatch,
    createReview,
    decideReview,
    commentReview,
    runActive,
    setAutonomy,
    completeLesson,
    resetWorkspace,
    setLayout,
    jumpToLine,
    toast,
    clearToasts: () => state.toasts.forEach((item) => dispatch({ type: 'dropToast', id: item.id })),
    findings,
    severityCounts,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}
