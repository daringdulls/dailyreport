import type { DailyReport, HotelRow } from '../types';
import { autoRoomRevenue, manualRoomRevenue, money, otherRateRooms, paidRooms, roomRevenue, standardRooms } from '../calc';

type Update = (fn: (r: DailyReport) => DailyReport) => void;

// Screen-only panel under "1. Hotel Revenue & ADR": one row per hotel with FOC rooms
// and the paid rooms sold at each other rate (local, agent…). Rate names and prices
// live in Setup; here you only count rooms. Not printed. Feeds Room Revenue, ADR, RevPAR.
export default function RateBreakdown({
  rep,
  update,
  onOpenSetup,
}: {
  rep: DailyReport;
  update: Update;
  onOpenSetup?: () => void;
}) {
  const m = (n: number) => money(n, rep.currency);
  // one column per rate name, in the order they first appear across hotels
  const rateNames: string[] = [];
  for (const h of rep.hotels)
    for (const r of h.otherRates ?? []) {
      const n = r.name.trim() || 'Other';
      if (!rateNames.includes(n)) rateNames.push(n);
    }

  const setHotel = (i: number, fn: (h: HotelRow) => HotelRow) =>
    update((r) => ({ ...r, hotels: r.hotels.map((h, j) => (j === i ? fn(h) : h)) }));
  const setRooms = (i: number, name: string, rooms: number) =>
    setHotel(i, (h) => ({
      ...h,
      otherRates: (h.otherRates ?? []).map((r) => ((r.name.trim() || 'Other') === name ? { ...r, rooms } : r)),
    }));

  const tot = rep.hotels.reduce(
    (a, h) => ({
      occupied: a.occupied + (h.occupied || 0),
      foc: a.foc + (h.foc || 0),
      paid: a.paid + paidRooms(h),
      std: a.std + standardRooms(h),
      revenue: a.revenue + roomRevenue(h),
    }),
    { occupied: 0, foc: 0, paid: 0, std: 0, revenue: 0 },
  );
  const rateTot = (name: string) =>
    rep.hotels.reduce((a, h) => a + ((h.otherRates ?? []).find((r) => (r.name.trim() || 'Other') === name)?.rooms || 0), 0);
  const problems = rep.hotels.flatMap((h) => [
    ...((h.foc || 0) > (h.occupied || 0) ? [`${h.name}: FOC rooms (${h.foc}) are more than occupied rooms (${h.occupied || 0}).`] : []),
    ...(otherRateRooms(h) > paidRooms(h)
      ? [`${h.name}: ${otherRateRooms(h)} rooms at other rates, but only ${paidRooms(h)} paid rooms.`]
      : []),
  ]);
  const manual = rep.hotels.filter((h) => manualRoomRevenue(h) != null);

  return (
    <section className="rates-panel screen-only">
      <header>
        <div>
          <h4>FOC &amp; room rates today</h4>
          <p>
            Count FOC rooms and rooms sold at other rates. The remaining paid rooms are charged the standard rate.
          </p>
        </div>
        <div className="rp-actions">
          <span className="chip">Not printed</span>
          {onOpenSetup && (
            <button className="link" onClick={onOpenSetup}>
              Edit rates in Setup
            </button>
          )}
        </div>
      </header>

      <div className="tw">
        <table className="rp-table">
          <thead>
            <tr>
              <th className="wide" rowSpan={2}>Hotel</th>
              <th rowSpan={2}>Occupied</th>
              <th rowSpan={2} title="Free of charge: counted as occupied, no revenue">FOC (free)</th>
              <th rowSpan={2} title="Occupied minus FOC (free)">Paid</th>
              <th rowSpan={2} title="Paid rooms not sold at another rate">Standard rate</th>
              {rateNames.length > 0 && <th colSpan={rateNames.length}>Other rates (rooms)</th>}
              <th rowSpan={2}>Room revenue</th>
              <th rowSpan={2}>ADR</th>
            </tr>
            <tr>
              {rateNames.map((n) => (
                <th key={n} className="rate-name">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rep.hotels.map((h, i) => {
              const over = otherRateRooms(h) > paidRooms(h);
              const focOver = (h.foc || 0) > (h.occupied || 0);
              const rev = roomRevenue(h);
              const paid = paidRooms(h);
              return (
                <tr key={i}>
                  <td className="label">{h.name}</td>
                  <td className="calc num">{h.occupied || 0}</td>
                  <td className={`in num ${focOver ? 'bad' : ''}`}>
                    <input
                      type="number"
                      min={0}
                      value={h.foc || 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setHotel(i, (x) => ({ ...x, foc: Math.max(0, Number(e.target.value) || 0) }))}
                      aria-label={`FOC rooms at ${h.name}`}
                    />
                  </td>
                  <td className="calc num">{paid}</td>
                  <td className={`calc num ${over ? 'bad' : ''}`}>
                    <RateCell rooms={standardRooms(h)} rate={h.roomRate || 0} m={m} />
                  </td>
                  {rateNames.map((n) => {
                    const r = (h.otherRates ?? []).find((x) => (x.name.trim() || 'Other') === n);
                    if (!r)
                      return (
                        <td key={n} className="calc num na" title={`${h.name} has no "${n}" rate (add it in Setup)`}>
                          –
                        </td>
                      );
                    return (
                      <td key={n} className={`in num ${over ? 'bad' : ''}`}>
                        <div className="rp-in">
                          <input
                            type="number"
                            min={0}
                            value={r.rooms || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setRooms(i, n, Math.max(0, Number(e.target.value) || 0))}
                            aria-label={`${n} rooms at ${h.name}`}
                          />
                          <small>@ {m(r.rate || 0)}</small>
                        </div>
                      </td>
                    );
                  })}
                  <td className="calc num b">
                    {m(rev)}
                    {manualRoomRevenue(h) != null && <small className="tag">typed</small>}
                  </td>
                  <td className="calc num">{m(paid ? rev / paid : 0)}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td>TOTAL</td>
              <td>{tot.occupied}</td>
              <td>{tot.foc}</td>
              <td>{tot.paid}</td>
              <td>{tot.std}</td>
              {rateNames.map((n) => (
                <td key={n}>{rateTot(n)}</td>
              ))}
              <td>{m(tot.revenue)}</td>
              <td>{m(tot.paid ? tot.revenue / tot.paid : 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {rateNames.length === 0 && (
        <p className="rp-note">
          No other rates yet. Add rates such as <i>Local</i> per hotel in Setup → Hotels → “+ Other rate”.
        </p>
      )}
      {problems.map((p) => (
        <p key={p} className="rp-note bad">
          ⚠ {p}
        </p>
      ))}
      {manual.length > 0 && (
        <p className="rp-note">
          <small className="tag">typed</small> Room revenue for {manual.map((h) => h.name).join(', ')} was typed in the
          table above, so the rates are not used for {manual.length > 1 ? 'those hotels' : 'that hotel'}. Clear the
          figure (or enter 0) to calculate it from the rates ({manual.map((h) => m(autoRoomRevenue(h))).join(', ')}).
        </p>
      )}
    </section>
  );
}

function RateCell({ rooms, rate, m }: { rooms: number; rate: number; m: (n: number) => string }) {
  return (
    <div className="rp-in">
      <span>{rooms}</span>
      <small>@ {m(rate)}</small>
    </div>
  );
}
