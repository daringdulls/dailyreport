// GET    /api/report?date=YYYY-MM-DD           -> { report, etag }
// PUT    /api/report?date=YYYY-MM-DD           body { report, etag? } -> { etag }
//        etag = version the client started from; a mismatch returns 409 so edits
//        made on another device are never silently overwritten.
// DELETE /api/report?date=YYYY-MM-DD
import { BlobPreconditionFailedError, del, get, head, put } from '@vercel/blob';
import { isDate, json, pathFor, unauthorized } from './_shared';

const dateOf = (req: Request) => new URL(req.url).searchParams.get('date');

async function current(date: string) {
  try {
    return await head(pathFor(date));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;
  const date = dateOf(req);
  if (!isDate(date)) return json({ error: 'Bad date' }, 400);
  const res = await get(pathFor(date), { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return json({ error: 'Not found' }, 404);
  const report = JSON.parse(await new Response(res.stream).text());
  return json({ report, etag: res.blob.etag });
}

export async function PUT(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;
  const date = dateOf(req);
  if (!isDate(date)) return json({ error: 'Bad date' }, 400);
  const body = (await req.json()) as { report?: { date?: string }; etag?: string | null; force?: boolean };
  if (!body.report || body.report.date !== date) return json({ error: 'Report date mismatch' }, 400);
  const data = JSON.stringify(body.report);
  if (data.length > 1_000_000) return json({ error: 'Report too large' }, 413);

  const opts = {
    access: 'private' as const,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  };
  try {
    let saved;
    if (body.force) {
      saved = await put(pathFor(date), data, { ...opts, allowOverwrite: true });
    } else if (body.etag) {
      saved = await put(pathFor(date), data, { ...opts, allowOverwrite: true, ifMatch: body.etag });
    } else {
      // brand-new report: refuse if another device already created this date
      const existing = await current(date);
      if (existing) return json({ error: 'conflict', etag: existing.etag, uploadedAt: existing.uploadedAt }, 409);
      saved = await put(pathFor(date), data, { ...opts, allowOverwrite: false });
    }
    return json({ etag: saved.etag });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError || /already exists/i.test(String(e))) {
      const existing = await current(date);
      return json({ error: 'conflict', etag: existing?.etag, uploadedAt: existing?.uploadedAt }, 409);
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;
  const date = dateOf(req);
  if (!isDate(date)) return json({ error: 'Bad date' }, 400);
  await del(pathFor(date));
  return json({ ok: true });
}
