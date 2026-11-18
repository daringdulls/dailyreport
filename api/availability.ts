// GET /api/availability?date=YYYY-MM-DD
// Reads the Pixel availability app's read-only feed (counts only, no guest data)
// for the report night and the 7 nights after it, and returns occupied rooms per
// property. Needs AVAILABILITY_FEED_TOKEN (the availability app's B2B_FEED_TOKEN).
import { isDate, json, unauthorized } from './_shared.js';

const FEED_URL = process.env.AVAILABILITY_FEED_URL || 'https://pixel-availability-55z6.vercel.app/api/availability';

type Feed = {
  nights: string[];
  properties: { name: string; roomTypes: { roomType: string; rooms: number; free: number[] }[] }[];
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;
  const date = new URL(req.url).searchParams.get('date');
  if (!isDate(date)) return json({ error: 'Bad date' }, 400);
  const token = process.env.AVAILABILITY_FEED_TOKEN;
  if (!token) return json({ error: 'not_configured' }, 501);

  const url = `${FEED_URL}?from=${date}&to=${addDays(date, 8)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  } catch {
    return json({ error: 'Could not reach the availability app' }, 502);
  }
  if (res.status === 401) return json({ error: 'The availability app rejected the feed token' }, 502);
  if (!res.ok) return json({ error: `Availability app error ${res.status}` }, 502);
  const feed = (await res.json()) as Feed;

  const properties = feed.properties.map((p) => {
    const rooms = p.roomTypes.reduce((a, t) => a + t.rooms, 0);
    const occupied = feed.nights.map((_, i) => p.roomTypes.reduce((a, t) => a + (t.rooms - (t.free[i] ?? t.rooms)), 0));
    return { name: p.name, rooms, occupied };
  });
  return json({ nights: feed.nights, properties });
}
