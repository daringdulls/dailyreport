import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyReport } from './types';
import {
  AuthError,
  ConflictError,
  deleteReport,
  fetchReport,
  listReports,
  saveReport,
  type IndexEntry,
} from './cloud';
import { loadAll, loadMeta, saveAll, saveMeta, type Meta, type Store } from './storage';

// How long after the last keystroke a report is saved to the cloud. Also saved
// when you switch tabs/apps, press "Save now", or leave the page.
const SAVE_DELAY_MS = 15_000;
const REFRESH_MIN_GAP_MS = 60_000;

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'offline'; message: string }
  | { kind: 'loading' };

export function useCloudStore(enabled: boolean, onAuthFail: () => void) {
  const [store, setStore] = useState<Store>(() => loadAll());
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [index, setIndex] = useState<Record<string, IndexEntry>>({});
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [conflict, setConflict] = useState<string | null>(null);

  // refs so async callbacks always see the latest state
  const storeRef = useRef(store);
  const metaRef = useRef(meta);
  const indexRef = useRef(index);
  storeRef.current = store;
  metaRef.current = meta;
  indexRef.current = index;
  const lastRefresh = useRef(0);
  const saving = useRef(new Set<string>());

  useEffect(() => void saveAll(store), [store]);
  useEffect(() => void saveMeta(meta), [meta]);

  const handleError = useCallback(
    (e: unknown, date?: string) => {
      if (e instanceof AuthError) return onAuthFail();
      if (e instanceof ConflictError && date) return setConflict(date);
      setStatus({ kind: 'offline', message: e instanceof Error ? e.message : String(e) });
    },
    [onAuthFail],
  );

  /** Pull the latest copy of one date from the cloud, unless this device has unsaved edits. */
  const ensureLoaded = useCallback(
    async (date: string, idx = indexRef.current) => {
      const entry = idx[date];
      const m = metaRef.current[date];
      if (!entry || m?.dirty) return;
      if (storeRef.current[date] && m?.etag === entry.etag) return;
      setStatus({ kind: 'loading' });
      try {
        const { report, etag } = await fetchReport(date);
        setStore((s) => ({ ...s, [date]: report }));
        setMeta((mm) => ({ ...mm, [date]: { etag, dirty: false } }));
        setStatus({ kind: 'idle' });
      } catch (e) {
        handleError(e, date);
      }
    },
    [handleError],
  );

  const refreshIndex = useCallback(async () => {
    lastRefresh.current = Date.now();
    try {
      const list = await listReports();
      const idx = Object.fromEntries(list.map((x) => [x.date, x]));
      setIndex(idx);
      setIndexLoaded(true);
      // Reports that exist only on this device (from before the cloud was set up)
      // are queued for upload. Local copies the cloud no longer has are dropped.
      setMeta((mm) => {
        const next = { ...mm };
        for (const d of Object.keys(storeRef.current)) {
          if (!next[d] && !idx[d]) next[d] = { etag: null, dirty: true };
        }
        return next;
      });
      setStore((s) => {
        const next = { ...s };
        for (const d of Object.keys(next)) {
          const m = metaRef.current[d];
          if (!idx[d] && m && m.etag && !m.dirty) delete next[d]; // deleted on another device
        }
        return next;
      });
      return idx;
    } catch (e) {
      handleError(e);
      return null;
    }
  }, [handleError]);

  const saveNow = useCallback(
    async (date: string, force = false) => {
      const rep = storeRef.current[date];
      if (!rep || saving.current.has(date)) return;
      saving.current.add(date);
      const snapshot = rep.updatedAt;
      setStatus({ kind: 'saving' });
      try {
        const etag = await saveReport(rep, metaRef.current[date]?.etag ?? null, force);
        const stillSame = storeRef.current[date]?.updatedAt === snapshot;
        setMeta((mm) => ({ ...mm, [date]: { etag, dirty: !stillSame } }));
        setIndex((i) => ({ ...i, [date]: { date, etag, uploadedAt: new Date().toISOString() } }));
        setConflict((c) => (c === date ? null : c));
        setStatus({ kind: 'saved', at: new Date() });
      } catch (e) {
        handleError(e, date);
      } finally {
        saving.current.delete(date);
      }
    },
    [handleError],
  );

  const saveAllDirty = useCallback(() => {
    for (const [d, m] of Object.entries(metaRef.current)) if (m.dirty && d !== conflict) void saveNow(d);
  }, [saveNow, conflict]);

  // first load
  useEffect(() => {
    if (enabled) void refreshIndex();
  }, [enabled, refreshIndex]);

  // debounced autosave
  useEffect(() => {
    if (!enabled || !indexLoaded) return;
    if (!Object.values(meta).some((m) => m.dirty)) return;
    const t = setTimeout(saveAllDirty, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [store, meta, enabled, indexLoaded, saveAllDirty]);

  // save when the page is hidden; refresh when it comes back
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') saveAllDirty();
      else if (Date.now() - lastRefresh.current > REFRESH_MIN_GAP_MS) void refreshIndex();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.values(metaRef.current).some((m) => m.dirty)) {
        saveAllDirty();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [enabled, saveAllDirty, refreshIndex]);

  /** Apply an edit (or create a report) locally; it is saved to the cloud shortly after. */
  const put = useCallback((date: string, rep: DailyReport) => {
    setStore((s) => ({ ...s, [date]: { ...rep, updatedAt: new Date().toISOString() } }));
    setMeta((mm) => ({ ...mm, [date]: { etag: mm[date]?.etag ?? indexRef.current[date]?.etag ?? null, dirty: true } }));
  }, []);

  const remove = useCallback(
    async (date: string) => {
      try {
        if (indexRef.current[date]) await deleteReport(date);
        setStore((s) => {
          const n = { ...s };
          delete n[date];
          return n;
        });
        setMeta((mm) => {
          const n = { ...mm };
          delete n[date];
          return n;
        });
        setIndex((i) => {
          const n = { ...i };
          delete n[date];
          return n;
        });
      } catch (e) {
        handleError(e);
      }
    },
    [handleError],
  );

  /** Resolve a conflict: keep the cloud version (discard edits here) or overwrite it with ours. */
  const resolveConflict = useCallback(
    async (keep: 'theirs' | 'mine') => {
      const date = conflict;
      if (!date) return;
      if (keep === 'mine') return saveNow(date, true);
      setMeta((mm) => ({ ...mm, [date]: { etag: null, dirty: false } }));
      metaRef.current = { ...metaRef.current, [date]: { etag: null, dirty: false } };
      setConflict(null);
      const idx = await refreshIndex();
      if (idx) await ensureLoaded(date, idx);
    },
    [conflict, saveNow, refreshIndex, ensureLoaded],
  );

  const dirtyCount = Object.values(meta).filter((m) => m.dirty).length;
  const dates = Array.from(new Set([...Object.keys(index), ...Object.keys(store)])).sort();

  return {
    store,
    index,
    indexLoaded,
    dates,
    status,
    conflict,
    dirtyCount,
    isDirty: (d: string) => !!meta[d]?.dirty,
    put,
    remove,
    ensureLoaded,
    refreshIndex,
    saveAllDirty,
    resolveConflict,
  };
}
