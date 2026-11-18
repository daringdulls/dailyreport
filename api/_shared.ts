// Shared helpers for the API routes (files starting with "_" are not deployed as routes).
import { timingSafeEqual } from 'node:crypto';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Every request must carry the shared passcode (APP_PASSCODE env var) in x-passcode. */
export function unauthorized(req: Request): Response | null {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return json({ error: 'APP_PASSCODE is not configured on the server' }, 500);
  const given = req.headers.get('x-passcode') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: 'Wrong passcode' }, 401);
  return null;
}

export const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const pathFor = (date: string) => `reports/${date}.json`;
