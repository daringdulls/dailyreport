import type { DailyReport } from '../types';
import { autoRoomRevenue, manualRoomRevenue, diveRuleOf, compute, forecastLabels, longDate, money, pct } from '../calc';
import { Calc, Label, NumIn, Section, TextIn, DateCell } from '../components/Cells';
import { useRowSetters } from './OperationsReport';
import RateBreakdown from './RateBreakdown';

type Update = (fn: (r: DailyReport) => DailyReport) => void;

// Grey cells here come straight from the Operations report; yellow cells are the
// money-only inputs (room revenue, rates, dive-type split).
export default function FinancialReport({
  rep,
  update,
  onPickDate,
  onOpenSetup,
}: {
  rep: DailyReport;
  update: Update;
  onPickDate: (date: string) => void;
  onOpenSetup?: () => void;
}) {
  const c = compute(rep);
  const set = useRowSetters(update);
  const days = forecastLabels(rep.date);
  const m = (n: number) => money(n, rep.currency);
  const anyMismatch = c.dive.some((d) => d.mismatch);

  return (
    <div className="sheet" id="fin-sheet">
      <div className="title">COZY HOTEL DAILY FINANCIAL REPORT</div>
      <table className="meta">
        <tbody>
          <tr>
            <Label>Report Date:</Label>
            <DateCell value={rep.date} label={longDate(rep.date)} onPick={onPickDate} />
            <Label>Prepared By:</Label>
            <TextIn value={rep.finPreparedBy} onChange={(v) => update((r) => ({ ...r, finPreparedBy: v }))} />
            <Label>Currency:</Label>
            <td className="in center">
              <select
                className="screen-only"
                value={rep.currency}
                onChange={(e) => update((r) => ({ ...r, currency: e.target.value }))}
              >
                <option>USD</option>
                <option>MVR</option>
              </select>
              <span className="print-only">{rep.currency}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="legend">Legend: Yellow = fill in daily | Grey = auto-calculated / taken from Operations report</div>

      <Section title="1. HOTEL REVENUE & ADR — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              <th>Total Rooms</th>
              <th>Occupied Rooms</th>
              <th>Vacant Rooms</th>
              <th>Occ. %</th>
              <th title="Blank = paid rooms × their rates (standard + other rates below) (Setup). Type a figure to override.">Room Revenue</th>
              <th title="Room revenue ÷ paid rooms (occupied minus FOC)">ADR</th>
              <th>RevPAR</th>
              <th>In-House Guests</th>
              <th className="wide">Guest Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rep.hotels.map((h, i) => (
              <tr key={i}>
                <Label>{h.name}</Label>
                <Calc>{h.totalRooms}</Calc>
                <Calc>{h.occupied}</Calc>
                <Calc>{c.hotels[i].vacant}</Calc>
                <Calc>{pct(c.hotels[i].occ)}</Calc>
                <NumIn
                  value={manualRoomRevenue(h)}
                  nullable
                  autoValue={autoRoomRevenue(h)}
                  prefix="$"
                  onChange={(v) => set.hotel(i, { roomRevenue: v || null })}
                />
                <Calc>{m(c.hotels[i].adr)}</Calc>
                <Calc>{m(c.hotels[i].revpar)}</Calc>
                <Calc>{h.inHouse}</Calc>
                <TextIn value={h.finRemarks} onChange={(v) => set.hotel(i, { finRemarks: v })} />
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL — ALL HOTELS</td>
              <td>{c.hotelTot.totalRooms}</td>
              <td>{c.hotelTot.occupied}</td>
              <td>{c.hotelTot.vacant}</td>
              <td>{pct(c.hotelTot.occ)}</td>
              <td>{m(c.hotelTot.roomRevenue)}</td>
              <td>{m(c.hotelTot.adr)}</td>
              <td>{m(c.hotelTot.revpar)}</td>
              <td>{c.hotelTot.inHouse}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <RateBreakdown rep={rep} update={update} onOpenSetup={onOpenSetup} />

      <Section title="2. NEXT 7 DAYS OCCUPANCY FORECAST — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
              <th>Proj. ADR</th>
            </tr>
          </thead>
          <tbody>
            {rep.hotels.map((h, i) => (
              <tr key={i}>
                <Label>{h.name}</Label>
                {h.forecast.map((v, d) => (
                  <Calc key={d}>{v}%</Calc>
                ))}
                <NumIn value={h.projAdr} prefix="$" step={0.5} onChange={(v) => set.hotel(i, { projAdr: v ?? 0 })} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="3. FOOD & BEVERAGE REVENUE — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel / Outlet</th>
              <th>Breakfast Covers</th>
              <th>Lunch Covers</th>
              <th>Dinner Covers</th>
              <th>Total Covers</th>
              <th>Total F&amp;B Revenue</th>
              <th>Avg. Spend /Guest</th>
              <th className="wide">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rep.outlets.map((o, i) => (
              <tr key={i}>
                <Label>{o.name}</Label>
                <Calc>{o.breakfast}</Calc>
                <Calc>{o.lunch}</Calc>
                <Calc>{o.dinner}</Calc>
                <Calc>{c.outlets[i].covers}</Calc>
                <Calc className="b">{m(c.outlets[i].revenue)}</Calc>
                <Calc>{m(c.outlets[i].avgSpend)}</Calc>
                <TextIn value={o.finRemarks} onChange={(v) => set.outlet(i, { finRemarks: v })} />
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL — ALL OUTLETS</td>
              <td>{c.outletTot.breakfast}</td>
              <td>{c.outletTot.lunch}</td>
              <td>{c.outletTot.dinner}</td>
              <td>{c.outletTot.covers}</td>
              <td>{m(c.outletTot.revenue)}</td>
              <td>{m(c.outletTot.covers ? c.outletTot.revenue / c.outletTot.covers : 0)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <Section title="4. DIVING REVENUE — FUVAHMULAH SCUBA CLUB — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide" rowSpan={2}>
                Hotel
              </th>
              <th colSpan={2} className="screen-only" title="Worked out from in-house divers × the daily dive rule (Setup)">
                In-House dives
              </th>
              <th colSpan={2} className="screen-only" title="Worked out from walk-in divers × the daily dive rule (Setup)">
                Walk-in dives
              </th>
              <th rowSpan={2}>In-House Dives</th>
              <th rowSpan={2}>Free/ walkIn Dives</th>
              <th rowSpan={2}>Courses</th>
              <th rowSpan={2}>Dhoni Trips</th>
              <th rowSpan={2}>Equip. Rentals</th>
              <th rowSpan={2} className="screen-only">
                Override revenue
              </th>
              <th rowSpan={2}>Total Diving Revenue</th>
            </tr>
            <tr className="screen-only">
              <th>Reef</th>
              <th>Tiger</th>
              <th>Reef</th>
              <th>Tiger</th>
            </tr>
          </thead>
          <tbody>
            {rep.dive.map((d, i) => {
              const cd = c.dive[i];
              return (
                <tr key={i} className={cd.mismatch ? 'warn' : ''}>
                  <Label>
                    {d.name}
                    {d.splitManual && (
                      <span className="screen-only dive-edited">
                        {' '}
                        <span className="tag" title={`By the daily rule: ${cd.byRule.reefIn} reef / ${cd.byRule.tigerIn} tiger in-house, ${cd.byRule.reefWalk} / ${cd.byRule.tigerWalk} walk-in`}>
                          edited
                        </span>
                        <button className="link" onClick={() => set.dive(i, { splitManual: false })} title="Go back to divers × daily rule">
                          ↺ rule
                        </button>
                      </span>
                    )}
                  </Label>
                  {(['reefIn', 'tigerIn', 'reefWalk', 'tigerWalk'] as const).map((k) => (
                    <NumInScreen
                      key={k}
                      value={cd.split[k]}
                      auto={!d.splitManual}
                      onChange={(v) => set.dive(i, { ...cd.split, [k]: v, splitManual: true })}
                    />
                  ))}
                  <Calc>{cd.finInHouse}</Calc>
                  <Calc>{cd.finWalk}</Calc>
                  <Calc>{d.courses}</Calc>
                  <Calc>{d.dhoniTrips}</Calc>
                  <NumIn value={d.equipRentals} onChange={(v) => set.dive(i, { equipRentals: v ?? 0 })} />
                  <td className="in num screen-only">
                    <input
                      type="number"
                      value={d.revenueOverride ?? ''}
                      placeholder={String(cd.calcRevenue)}
                      onChange={(e) =>
                        set.dive(i, { revenueOverride: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </td>
                  <Calc className="b">{m(cd.revenue)}</Calc>
                </tr>
              );
            })}
            <tr className="total">
              <td>TOTAL — ALL HOTELS</td>
              <td className="screen-only" colSpan={4} />
              <td>{c.diveTot.finInHouse}</td>
              <td>{c.diveTot.finWalk}</td>
              <td>{c.diveTot.courses}</td>
              <td>{c.diveTot.dhoniTrips}</td>
              <td>{c.diveTot.equipRentals}</td>
              <td className="screen-only" />
              <td>{m(c.diveTot.revenue)}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small screen-only">
          Dives are worked out from the divers in the Operations report: each diver does {diveRuleOf(rep).reef} reef
          + {diveRuleOf(rep).tiger} tiger dive{diveRuleOf(rep).tiger === 1 ? '' : 's'} a day (change the rule in
          Setup). Type over a figure for a different day; that row is marked <i>edited</i>. Dive prices are set in Setup → Rates.
        </p>
        {anyMismatch && (
          <p className="hint screen-only">
            ⚠ The edited rows differ from divers × the daily rule. Check them before presenting, or press ↺ rule.
          </p>
        )}
      </div>

      <Section title="5. DAILY REVENUE SUMMARY — ALL BUSINESS UNITS" />
      <div className="tw">
        <table className="summary">
          <thead>
            <tr>
              <th className="wide">Revenue Stream</th>
              <th>Amount</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {c.summary.map((s) => (
              <tr key={s.label}>
                <Label>{s.label}</Label>
                <Calc>{m(s.amount)}</Calc>
                <Calc>{pct(s.pct)}</Calc>
              </tr>
            ))}
            <tr className="grand">
              <td>TOTAL DAILY REVENUE</td>
              <td>{m(c.totalRevenue)}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="signoff">
        <div>
          Reviewed by (Management):{' '}
          <input
            className="screen-only line"
            value={rep.reviewedBy}
            onChange={(e) => update((r) => ({ ...r, reviewedBy: e.target.value }))}
          />
          <span className="print-only line">{rep.reviewedBy}</span>
        </div>
        <div>
          Signature / Date: <span className="line" />
        </div>
      </div>
    </div>
  );
}

// Input that only shows on screen (the split columns are not on the printed report).
function NumInScreen({ value, onChange, auto }: { value: number; onChange: (v: number) => void; auto?: boolean }) {
  return (
    <td className={`in num screen-only ${auto ? 'auto' : ''}`} title={auto ? 'From divers × daily rule. Type to change.' : undefined}>
      <input
        type="number"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </td>
  );
}
