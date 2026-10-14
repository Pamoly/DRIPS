import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api';
import { uid } from './format';

const EMPTY = {
  clients: [],
  proposals: [],
  invoices: [],
  expenses: [],
  timeEntries: [],
  projects: [],
  sprints: [],
  tasks: [],
  goals: [],
  ledger: [],
  activity: [],
};

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const [collections, setCollections] = useState(EMPTY);
  const [meta, setMeta] = useState({});
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('drips.theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      return 'light';
    }
  });
  const saveTimers = useRef({});

  /* ------------------------------- toasts -------------------------------- */
  const toast = useCallback((message, type = 'success', opts = {}) => {
    const id = uid('t');
    setToasts((t) => [...t, { id, message, type, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 4200);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* -------------------------------- theme -------------------------------- */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      localStorage.setItem('drips.theme', theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  /* ------------------------------ bootstrap ------------------------------ */
  const hydrate = useCallback((payload) => {
    setSettings(payload.settings);
    setCollections({ ...EMPTY, ...(payload.collections || {}) });
    setMeta({ id: payload.id, plan: payload.plan, createdAt: payload.createdAt });
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    try {
      const { token } = await api.bootstrap();
      if (token) setToken(token);
      const state = await api.state();
      hydrate(state);
      setStatus('ready');
      return state;
    } catch (err) {
      setError(err.message);
      setStatus('error');
      return null;
    }
  }, [hydrate]);

  // A returning visitor is hydrated straight away; a first-time visitor stays
  // 'idle' until they open the app (the landing page needs no workspace).
  useEffect(() => {
    if (getToken()) bootstrap();
    else setStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWorkspace = useCallback(async () => {
    if (status === 'ready') return null;
    return bootstrap();
  }, [bootstrap, status]);

  /* ------------------------------ persistence ---------------------------- */
  const persistSettings = useCallback((next) => {
    setSettings(next);
    clearTimeout(saveTimers.current.settings);
    saveTimers.current.settings = setTimeout(() => {
      api.saveSettings(next).catch(() => {});
    }, 500);
  }, []);

  const updateSettings = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = { ...prev };
        for (const [group, value] of Object.entries(patch)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            next[group] = { ...(prev[group] || {}), ...value };
          } else {
            next[group] = value;
          }
        }
        clearTimeout(saveTimers.current.settings);
        saveTimers.current.settings = setTimeout(() => {
          api.saveSettings(next).catch(() => {});
        }, 600);
        return next;
      });
    },
    [],
  );

  const addItem = useCallback(async (collection, record) => {
    const optimistic = { id: uid(collection.slice(0, 3)), createdAt: new Date().toISOString(), ...record };
    setCollections((c) => ({ ...c, [collection]: [optimistic, ...(c[collection] || [])] }));
    try {
      const saved = await api.create(collection, record);
      setCollections((c) => ({
        ...c,
        [collection]: (c[collection] || []).map((r) => (r.id === optimistic.id ? saved : r)),
      }));
      return saved;
    } catch (err) {
      setCollections((c) => ({ ...c, [collection]: (c[collection] || []).filter((r) => r.id !== optimistic.id) }));
      throw err;
    }
  }, []);

  /** Optimistic patch; the write is debounced so sliders/text inputs stay smooth. */
  const updateItem = useCallback(
    (collection, id, patch, opts = {}) => {
      const key = `${collection}:${id}`;
      setCollections((c) => ({
        ...c,
        [collection]: (c[collection] || []).map((r) =>
          r.id === id ? { ...r, ...patch, id, updatedAt: new Date().toISOString() } : r,
        ),
      }));
      clearTimeout(saveTimers.current[key]);
      if (opts.localOnly) return;
      saveTimers.current[key] = setTimeout(() => {
        delete saveTimers.current[key];
        api.patch(collection, id, patch).catch((err) => {
          toast(`Could not save: ${err.message}`, 'error');
          bootstrap();
        });
      }, opts.debounce ?? 350);
    },
    [toast, bootstrap],
  );

  const saveItem = useCallback(async (collection, id, record) => {
    const saved = await api.update(collection, id, record);
    setCollections((c) => ({
      ...c,
      [collection]: (c[collection] || []).map((r) => (r.id === id ? saved : r)),
    }));
    return saved;
  }, []);

  const removeItem = useCallback(async (collection, id) => {
    const previous = collections[collection];
    setCollections((c) => ({ ...c, [collection]: (c[collection] || []).filter((r) => r.id !== id) }));
    try {
      await api.remove(collection, id);
    } catch (err) {
      setCollections((c) => ({ ...c, [collection]: previous }));
      toast(`Delete failed: ${err.message}`, 'error');
    }
  }, [collections, toast]);

  const replaceItems = useCallback(async (collection, rows) => {
    const previous = collections[collection];
    setCollections((c) => ({ ...c, [collection]: rows }));
    try {
      await api.replaceAll(collection, rows);
    } catch (err) {
      setCollections((c) => ({ ...c, [collection]: previous }));
      toast(`Save failed: ${err.message}`, 'error');
    }
  }, [collections, toast]);

  const replaceAll = useCallback(async (nextCollections) => {
    setCollections({ ...EMPTY, ...nextCollections });
  }, []);

  /* --------------------------- domain operations ------------------------- */
  const duplicateProposal = useCallback(async (id) => {
    const copy = await api.duplicateProposal(id);
    setCollections((c) => ({ ...c, proposals: [copy, ...c.proposals] }));
    return copy;
  }, []);

  const convertProposal = useCallback(async (id) => {
    const invoice = await api.convertProposal(id);
    setCollections((c) => ({ ...c, invoices: [invoice, ...c.invoices] }));
    return invoice;
  }, []);

  const addPayment = useCallback(async (id, payment) => {
    const invoice = await api.addPayment(id, payment);
    setCollections((c) => ({
      ...c,
      invoices: c.invoices.map((i) => (i.id === id ? invoice : i)),
    }));
    return invoice;
  }, []);

  const loadDemo = useCallback(async () => {
    const res = await api.demo();
    hydrate({ ...res, id: meta.id, plan: meta.plan });
    toast('Demo workspace loaded — explore every module', 'success');
  }, [hydrate, meta, toast]);

  const resetWorkspace = useCallback(async () => {
    const res = await api.reset();
    hydrate({ ...res, id: meta.id, plan: meta.plan });
    toast('Workspace cleared', 'success');
  }, [hydrate, meta, toast]);

  const restoreBackup = useCallback(async (payload) => {
    const res = await api.backup(payload);
    hydrate({ ...res, id: meta.id, plan: meta.plan });
    toast('Backup restored', 'success');
  }, [hydrate, meta, toast]);

  /* -------------------------------- derived ------------------------------ */
  const value = useMemo(() => {
    const clientMap = Object.fromEntries((collections.clients || []).map((c) => [c.id, c]));
    const projectMap = Object.fromEntries((collections.projects || []).map((p) => [p.id, p]));
    const taskMap = Object.fromEntries((collections.tasks || []).map((t) => [t.id, t]));
    const locale = settings?.locale?.numberFormat === 'en' ? 'en-US' : 'nl-NL';
    const currency = settings?.locale?.baseCurrency || 'EUR';
    const rates = settings?.rates || {};
    return {
      status,
      error,
      settings,
      collections,
      meta,
      locale,
      baseCurrency: currency,
      rates,
      clientMap,
      projectMap,
      taskMap,
      clientName: (id) => {
        const c = clientMap[id];
        return c ? c.company || c.name : '—';
      },
      projectName: (id) => projectMap[id]?.name || '',
      toasts,
      toast,
      dismissToast,
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      bootstrap,
      startWorkspace,
      hydrate,
      updateSettings,
      persistSettings,
      addItem,
      updateItem,
      saveItem,
      removeItem,
      replaceItems,
      replaceAll,
      duplicateProposal,
      convertProposal,
      addPayment,
      loadDemo,
      resetWorkspace,
      restoreBackup,
    };
  }, [
    status, error, settings, collections, meta, toasts, theme,
    toast, dismissToast, bootstrap, startWorkspace, hydrate, updateSettings, persistSettings,
    addItem, updateItem, saveItem, removeItem, replaceItems, replaceAll,
    duplicateProposal, convertProposal, addPayment, loadDemo, resetWorkspace, restoreBackup,
  ]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Convenience hook for record helpers bound to a collection. */
export function useCollection(name) {
  const app = useApp();
  return useMemo(
    () => ({
      rows: app.collections[name] || [],
      add: (record) => app.addItem(name, record),
      update: (id, patch, opts) => app.updateItem(name, id, patch, opts),
      save: (id, record) => app.saveItem(name, id, record),
      remove: (id) => app.removeItem(name, id),
      replace: (rows) => app.replaceItems(name, rows),
    }),
    [app, name],
  );
}
