import type {
  Analysis,
  AuditEvent,
  ChatEvent,
  LearningPayload,
  Lesson,
  Overview,
  Patch,
  Review,
  Run,
  WorkspaceFile,
} from '../types';

/**
 * All requests go to relative paths and are proxied by the dev server (or served by the
 * engine itself in production). The browser never needs to know where the backend is,
 * which keeps the app working behind any host, port or sandbox proxy.
 */
const jsonHeaders = { 'Content-Type': 'application/json' };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `${response.status} ${response.statusText}`;
    const error = new Error(message) as Error & { status?: number; payload?: any };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload as T;
}

export const api = {
  health: () => request<any>('/api/health'),

  workspace: () => request<any>('/api/workspace'),

  overview: () => request<Overview>('/api/health/overview'),

  files: () => request<{ files: WorkspaceFile[] }>('/api/files'),

  file: (path: string) =>
    request<{ file: WorkspaceFile; analysis: Analysis; patches: Patch[] }>(
      `/api/files/${encodeURIComponent(path)}`,
    ),

  createFile: (path: string, content?: string) =>
    request<{ file: WorkspaceFile; analysis: Analysis }>('/api/files', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path, content }),
    }),

  saveFile: (path: string, content: string) =>
    request<{ file: WorkspaceFile; analysis: Analysis }>(`/api/files/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ content }),
    }),

  deleteFile: (path: string) =>
    request<{ deleted: string }>(`/api/files/${encodeURIComponent(path)}`, { method: 'DELETE' }),

  analyze: (path: string) =>
    request<{ analysis: Analysis; summary: string }>(
      `/api/files/${encodeURIComponent(path)}/analyze`,
      { method: 'POST', headers: jsonHeaders, body: '{}' },
    ),

  patches: (status?: string) =>
    request<{ patches: Patch[] }>(`/api/patches${status ? `?status=${status}` : ''}`),

  propose: (file: string, limit = 12) =>
    request<{ patches: Patch[]; message: string }>('/api/patches/propose', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ file, limit }),
    }),

  decidePatch: (id: string, approve: boolean, note = '') =>
    request<{ patch: Patch }>(`/api/patches/${id}/decision`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ approve, note }),
    }),

  applyPatch: (id: string, force = false) =>
    request<{ patch: Patch; analysis: Analysis; file: WorkspaceFile }>(`/api/patches/${id}/apply`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ force }),
    }),

  revertPatch: (id: string) =>
    request<{ patch: Patch; analysis: Analysis }>(`/api/patches/${id}/revert`, {
      method: 'POST',
      headers: jsonHeaders,
      body: '{}',
    }),

  reviews: () => request<{ reviews: Review[] }>('/api/reviews'),

  createReview: (file: string) =>
    request<{ review: Review; recommendation: string }>('/api/reviews', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ file }),
    }),

  decideReview: (id: string, decision: string, note = '') =>
    request<{ review: Review }>(`/api/reviews/${id}/decision`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ decision, note }),
    }),

  commentReview: (id: string, body: string, line = 1, kind = 'comment') =>
    request<{ review: Review }>(`/api/reviews/${id}/comments`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ body, line, kind }),
    }),

  audit: (limit = 60) => request<{ events: AuditEvent[] }>(`/api/audit?limit=${limit}`),

  run: (file?: string, source?: string, language?: string) =>
    request<{ run: Run; diagnosis?: any; patches?: Patch[] }>('/api/runtime/run', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ file, source, language }),
    }),

  runs: () => request<{ runs: Run[] }>('/api/runtime/runs'),

  setAutonomy: (mode: string) =>
    request<{ autonomy: string; explanation: string }>('/api/autonomy', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ mode }),
    }),

  learning: () => request<LearningPayload>('/api/learning'),

  lesson: (id: string) =>
    request<{ lesson: Lesson }>('/api/learning/lesson', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ lesson: id }),
    }),

  completeLesson: (id: string) =>
    request<{ learner: any; level: any }>('/api/learning/complete', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ lesson: id }),
    }),

  reset: () => request<any>('/api/workspace/reset', { method: 'POST', headers: jsonHeaders, body: '{}' }),
};

/**
 * Streams the assistant's agent trace.
 *
 * Uses `fetch` with a streaming body reader rather than `EventSource`, because the
 * request carries a JSON payload (file, traceback, autonomy) and EventSource is GET-only.
 * Every event is delivered to `onEvent` as it arrives, so the plan, the steps, the patches
 * and the tokens all appear live.
 */
export async function streamChat(
  payload: { message: string; file?: string | null; traceback?: string; source?: string; language?: string; session_id?: string },
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Streaming failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const dataLine = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine) as ChatEvent);
      } catch {
        // a malformed frame must never break the session
      }
    }
  }
}
