// GET /api/reports -> list of saved report dates with their version tags.
import { list } from '@vercel/blob';
import { json, unauthorized } from './_shared.js';

export async function GET(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;
  const items: { date: string; etag: string; uploadedAt: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'reports/', cursor, limit: 1000 });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^reports\/(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) items.push({ date: m[1], etag: b.etag, uploadedAt: new Date(b.uploadedAt).toISOString() });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  items.sort((a, b) => a.date.localeCompare(b.date));
  return json({ reports: items });
}
