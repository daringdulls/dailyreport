import { useState } from 'react';
import type { DailyReport, HotelRow } from '../types';
import { fetchAvailability, type AvailabilityProperty } from '../cloud';

type Update = (fn: (r: DailyReport) => DailyReport) => void;

// "Import from availability app": fills Occupied Rooms (report night) and the
// 7-day forecast % from the Pixel availability app. Everything stays editable.

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)); // "Arts" = "Art"

/** Find the availability-app property for a hotel (exact alias first, then by words). */
export function matchProperty(h: HotelRow, props: AvailabilityProperty[]) {
  const alias = (h.availabilityName ?? '').trim().toLowerCase();
  if (alias) return props.find((p) => p.name.trim().toLowerCase() === alias);
  const hw = new Set(words(h.name));
  let best: AvailabilityProperty | undefined;
  let bestScore = 0;
  for (const p of props) {
    const pw = words(p.name);
    if (!pw.length || !pw.every((w) => hw.has(w))) continue; // every word of the property is in the hotel name
    if (pw.length > bestScore) {
      best = p;
      bestScore = pw.length;
    }
  }
  return best;
}

export default function AvailabilityImport({ rep, update }: { rep: DailyReport; update: Update }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; lines: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const data = await fetchAvailability(rep.date);
      const plan = rep.hotels.map((h) => {
        const p = matchProperty(h, data.properties);
        if (!p) return null;
        const rooms = p.rooms || h.totalRooms;
        return {
          prop: p,
          occupied: p.occupied[0] ?? 0,
          forecast: p.occupied.slice(1, 8).map((o) => (rooms ? Math.round((o / rooms) * 100) : 0)),
        };
      });
      if (!plan.some(Boolean)) {
        setMsg({
          kind: 'err',
          lines: [
            `None of the hotels matched a property in the availability app (${data.properties.map((p) => p.name).join(', ')}).`,
            'Set the name used there under Setup → Hotels → "Name in availability app".',
          ],
        });
        return;
      }
      const hasData = rep.hotels.some((h, i) => plan[i] && (h.occupied || h.forecast.some(Boolean)));
      if (hasData && !confirm('Replace Occupied Rooms and the 7-day forecast with the figures from the availability app? You can still edit them afterwards.'))
        return;
      update((r) => ({
        ...r,
        availabilityImportedAt: new Date().toISOString(),
        hotels: r.hotels.map((h, i) => {
          const p = plan[i];
          if (!p) return h;
          // the app gives rooms occupied tonight; keep today's movements and set last night to match
          const startRooms = Math.max(0, p.occupied - (h.arrivals || 0) + (h.departures || 0));
          return { ...h, startRooms, occupied: p.occupied, forecast: p.forecast };
        }),
      }));
      const lines = rep.hotels.map((h, i) => {
        const p = plan[i];
        if (!p) return `${h.name}: no matching property, left unchanged`;
        const note = p.prop.rooms !== h.totalRooms ? ` (availability app has ${p.prop.rooms} rooms, this report ${h.totalRooms})` : '';
        return `${h.name}: ${p.occupied} occupied tonight · forecast ${p.forecast.join('%, ')}%${note}`;
      });
      setMsg({ kind: 'ok', lines });
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setMsg({
        kind: 'err',
        lines:
          text === 'not_configured'
            ? ['The availability app is not connected yet: the AVAILABILITY_FEED_TOKEN setting is missing on Vercel.']
            : [text],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="avail screen-only">
      <button onClick={() => void run()} disabled={busy}>
        {busy ? 'Importing…' : '⇩ Import occupancy & forecast from availability app'}
      </button>
      <span className="muted">
        Fills tonight’s occupied rooms (Last night is adjusted to match today’s arrivals and departures) and the
        7-day forecast %. Guests, FOC and remarks are not changed. You can edit everything afterwards.
        {rep.availabilityImportedAt && (
          <> Last imported {new Date(rep.availabilityImportedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.</>
        )}
      </span>
      {msg && (
        <ul className={msg.kind === 'ok' ? 'ok' : 'err'}>
          {msg.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
