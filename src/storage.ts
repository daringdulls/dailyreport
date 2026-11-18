import type { DailyReport } from './types';

// Local copy of the reports on this device. The shared copy lives in the cloud
// (see cloud.ts / sync.ts); this cache keeps unsaved edits safe if the
// connection drops or the page is closed.
const KEY = 'cozy-daily-reports-v1';
const META_KEY = 'cozy-daily-reports-meta-v1';

export type Store = Record<string, DailyReport>;
/** etag = cloud version this copy is based on; dirty = has edits not yet saved to the cloud */
export type Meta = Record<string, { etag: string | null; dirty: boolean }>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadAll = () => read<Store>(KEY, {});
export const saveAll = (store: Store) => write(KEY, store);
export const loadMeta = () => read<Meta>(META_KEY, {});
export const saveMeta = (meta: Meta) => write(META_KEY, meta);

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
