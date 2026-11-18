import type { DailyReport } from './types';

// Thin client for the /api routes. The shared passcode is kept on the device
// after the first successful sign-in.
const PASS_KEY = 'cozy-passcode';

export const getPasscode = () => {
  try {
    return localStorage.getItem(PASS_KEY) ?? '';
  } catch {
    return '';
  }
};
export const setPasscode = (p: string) => {
  try {
    if (p) localStorage.setItem(PASS_KEY, p);
    else localStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
};

export class AuthError extends Error {}
export class ConflictError extends Error {
  constructor(public etag: string | undefined, public uploadedAt: string | undefined) {
    super('conflict');
  }
}

async function call<T>(path: string, init: RequestInit = {}, passcode = getPasscode()): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-passcode': passcode, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AuthError(body.error ?? 'Wrong passcode');
  if (res.status === 409) throw new ConflictError(body.etag, body.uploadedAt);
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
  return body as T;
}

export type IndexEntry = { date: string; etag: string; uploadedAt: string };

export const listReports = (passcode?: string) =>
  call<{ reports: IndexEntry[] }>('/api/reports', {}, passcode).then((r) => r.reports);

export const fetchReport = (date: string) =>
  call<{ report: DailyReport; etag: string }>(`/api/report?date=${date}`);

export const saveReport = (report: DailyReport, etag: string | null, force = false) =>
  call<{ etag: string }>(`/api/report?date=${report.date}`, {
    method: 'PUT',
    body: JSON.stringify({ report, etag, force }),
    keepalive: true,
  }).then((r) => r.etag);

export const deleteReport = (date: string) => call(`/api/report?date=${date}`, { method: 'DELETE' });
