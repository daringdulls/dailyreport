import type { DailyReport, HotelRow, OtherRate } from '../types';
import { autoRoomRevenue, manualRoomRevenue, money, otherRateRooms, paidRooms, standardRooms } from '../calc';

type Update = (fn: (r: DailyReport) => DailyReport) => void;

// Screen-only helper under "1. Hotel Revenue & ADR": rooms sold at other rates
// (local, agent…). Not printed; it only feeds Room Revenue, so ADR and RevPAR
// include every rate without adding a column to the report.
export default function RateBreakdown({ rep, update }: { rep: DailyReport; update: Update }) {
  const setRates = (i: number, fn: (rates: OtherRate[]) => OtherRate[]) =>
    update((r) => ({
      ...r,
      hotels: r.hotels.map((h, j) => (j === i ? { ...h, otherRates: fn(h.otherRates ?? []) } : h)),
    }));
  const m = (n: number) => money(n, rep.currency);

  return (
    <div className="breakdown screen-only">
      <div className="breakdown-head">
        <b>FOC rooms &amp; room rates today</b>
        <span className="muted">
          Not printed. FOC (free) rooms count as occupied but earn nothing. Of the paid rooms, enter how many were
          sold at another rate; the rest use the standard rate. Room revenue, ADR and RevPAR above include all of this.
        </span>
      </div>
      {rep.hotels.map((h, i) => (
        <HotelRates
          key={i}
          h={h}
          m={m}
          onFocChange={(foc) =>
            update((r) => ({ ...r, hotels: r.hotels.map((x, j) => (j === i ? { ...x, foc } : x)) }))
          }
          onRoomsChange={(k, rooms) => setRates(i, (rs) => rs.map((x, j) => (j === k ? { ...x, rooms } : x)))}
          onRateChange={(k, rate) => setRates(i, (rs) => rs.map((x, j) => (j === k ? { ...x, rate } : x)))}
          onAdd={() => setRates(i, (rs) => [...rs, { name: 'Local', rate: h.roomRate || 0, rooms: 0 }])}
          onRename={(k, name) => setRates(i, (rs) => rs.map((x, j) => (j === k ? { ...x, name } : x)))}
          onRemove={(k) => setRates(i, (rs) => rs.filter((_, j) => j !== k))}
        />
      ))}
    </div>
  );
}

function HotelRates({
  h,
  m,
  onFocChange,
  onRoomsChange,
  onRateChange,
  onAdd,
  onRename,
  onRemove,
}: {
  h: HotelRow;
  m: (n: number) => string;
  onFocChange: (n: number) => void;
  onRoomsChange: (k: number, n: number) => void;
  onRateChange: (k: number, n: number) => void;
  onAdd: () => void;
  onRename: (k: number, name: string) => void;
  onRemove: (k: number) => void;
}) {
  const rates = h.otherRates ?? [];
  const over = otherRateRooms(h) > paidRooms(h);
  const focOver = (h.foc || 0) > (h.occupied || 0);
  const manual = manualRoomRevenue(h) != null;
  return (
    <div className={`bd-hotel ${over || focOver ? 'over' : ''}`}>
      <div className="bd-name">
        <b>{h.name}</b>
        <span className="muted">
          {h.occupied || 0} occupied · {paidRooms(h)} paid
        </span>
      </div>
      <div className="bd-lines">
        <div className="bd-line foc">
          <span className="bd-label">FOC (free) rooms</span>
          <input
            type="number"
            className="bd-num rooms"
            min={0}
            value={h.foc ?? 0}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onFocChange(Math.max(0, Number(e.target.value) || 0))}
            aria-label="FOC rooms"
          />
          <span className="muted">counted as occupied, no revenue</span>
        </div>
        {focOver && <p className="hint">⚠ More FOC rooms than occupied rooms ({h.occupied || 0}).</p>}
        <div className="bd-line std">
          <span className="bd-label">Standard</span>
          <span className="muted">{m(h.roomRate || 0)} ×</span>
          <span className="bd-auto" title="Paid rooms not listed under another rate">
            {standardRooms(h)}
          </span>
          <span className="bd-sum">{m(standardRooms(h) * (h.roomRate || 0))}</span>
        </div>
        {rates.map((r, k) => (
          <div className="bd-line" key={k}>
            <input className="bd-label" value={r.name} onChange={(e) => onRename(k, e.target.value)} aria-label="Rate name" />
            <span className="muted">$</span>
            <input
              type="number"
              className="bd-num"
              value={r.rate}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onRateChange(k, Number(e.target.value) || 0)}
              aria-label="Rate"
            />
            <span className="muted">×</span>
            <input
              type="number"
              className="bd-num rooms"
              min={0}
              value={r.rooms}
              onFocus={(e) => e.target.select()}
              onChange={(e) => onRoomsChange(k, Math.max(0, Number(e.target.value) || 0))}
              aria-label="Rooms at this rate"
            />
            <span className="bd-sum">{m((r.rooms || 0) * (r.rate || 0))}</span>
            <button className="icon" title="Remove this rate" onClick={() => onRemove(k)}>
              ×
            </button>
          </div>
        ))}
        <div className="bd-foot">
          <button className="add" onClick={onAdd}>
            + Add other rate
          </button>
          <span className="bd-total">
            Room revenue <b>{m(autoRoomRevenue(h))}</b>
          </span>
        </div>
        {over && <p className="hint">⚠ More rooms at other rates than paid rooms ({paidRooms(h)}).</p>}
        {manual && (
          <p className="hint">
            Room revenue for this hotel was typed in by hand ({m(h.roomRevenue!)}), so this breakdown is not used.
            Clear the Room Revenue cell above to use it.
          </p>
        )}
      </div>
    </div>
  );
}
