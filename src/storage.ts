import type { DailyReport } from './types';

// Reports are kept in this browser's localStorage, keyed by date.
// Use "Backup" / "Restore" in the app to move them between devices.
const KEY = 'cozy-daily-reports-v1';

export type Store = Record<string, DailyReport>;

export function loadAll(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function saveAll(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
