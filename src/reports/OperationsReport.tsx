import type { DailyReport, DiveRow, HotelRow, OutletRow } from '../types';
import { compute, forecastLabels, longDate, pct } from '../calc';
import { Calc, Label, NumIn, RowTools, Section, TextIn, DateCell } from '../components/Cells';
import AvailabilityImport from './AvailabilityImport';

type Update = (fn: (r: DailyReport) => DailyReport) => void;

export function useRowSetters(update: Update) {
  return {
    hotel: (i: number, p: Partial<HotelRow>) =>
      update((r) => ({ ...r, hotels: r.hotels.map((h, j) => (j === i ? { ...h, ...p } : h)) })),
    outlet: (i: number, p: Partial<OutletRow>) =>
      update((r) => ({ ...r, outlets: r.outlets.map((o, j) => (j === i ? { ...o, ...p } : o)) })),
    dive: (i: number, p: Partial<DiveRow>) =>
      update((r) => ({ ...r, dive: r.dive.map((d, j) => (j === i ? { ...d, ...p } : d)) })),
  };
}

export default function OperationsReport({
  rep,
  update,
  onPickDate,
}: {
  rep: DailyReport;
  update: Update;
  onPickDate: (date: string) => void;
}) {
  const c = compute(rep);
  const set = useRowSetters(update);
  const days = forecastLabels(rep.date);

  const setOcc = (i: number, p: Partial<DailyReport['occasions'][number]>) =>
    update((r) => ({ ...r, occasions: r.occasions.map((o, j) => (j === i ? { ...o, ...p } : o)) }));
  const setRoster = (i: number, p: Partial<DailyReport['roster'][number]>) =>
    update((r) => ({ ...r, roster: r.roster.map((o, j) => (j === i ? { ...o, ...p } : o)) }));

  return (
    <div className="sheet" id="ops-sheet">
      <div className="title">COZY HOTEL DAILY OPERATIONS REPORT</div>
      <table className="meta">
        <tbody>
          <tr>
            <Label>Report Date:</Label>
            <DateCell value={rep.date} label={longDate(rep.date)} onPick={onPickDate} />
            <Label>Prepared By:</Label>
            <TextIn value={rep.opsPreparedBy} onChange={(v) => update((r) => ({ ...r, opsPreparedBy: v }))} />
            <Label>Shift:</Label>
            <TextIn value={rep.shift} onChange={(v) => update((r) => ({ ...r, shift: v }))} className="center" />
          </tr>
        </tbody>
      </table>
      <div className="legend">Legend: Yellow = fill in daily | Grey = auto-calculated (do not edit)</div>

      <AvailabilityImport rep={rep} update={update} />
      <Section title="1. HOTEL OPERATIONS — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              <th>Total Rooms</th>
              <th title="Includes FOC rooms">Occupied Rooms (incl. FOC)</th>
              <th title="Complimentary rooms: occupied but free of charge">FOC Rooms</th>
              <th>Vacant Rooms</th>
              <th>Occ. %</th>
              <th>In-House Guests</th>
              <th>Arrivals Today</th>
              <th>Departures Today</th>
              <th className="wide">Guest Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rep.hotels.map((h, i) => (
              <tr key={i} className={c.hotels[i].focError ? 'warn' : ''}>
                <Label>
                  {h.name}
                  {c.hotels[i].focError && <span className="flag screen-only"> ⚠ FOC is more than occupied</span>}
                </Label>
                <Calc>{h.totalRooms}</Calc>
                <NumIn value={h.occupied} onChange={(v) => set.hotel(i, { occupied: v ?? 0 })} />
                <NumIn value={h.foc ?? 0} onChange={(v) => set.hotel(i, { foc: v ?? 0 })} />
                <Calc>{c.hotels[i].vacant}</Calc>
                <Calc>{pct(c.hotels[i].occ)}</Calc>
                <NumIn value={h.inHouse} onChange={(v) => set.hotel(i, { inHouse: v ?? 0 })} />
                <NumIn value={h.arrivals} onChange={(v) => set.hotel(i, { arrivals: v ?? 0 })} />
                <NumIn value={h.departures} onChange={(v) => set.hotel(i, { departures: v ?? 0 })} />
                <TextIn value={h.remarks} onChange={(v) => set.hotel(i, { remarks: v })} />
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL — ALL HOTELS</td>
              <td>{c.hotelTot.totalRooms}</td>
              <td>{c.hotelTot.occupied}</td>
              <td>{c.hotelTot.foc}</td>
              <td>{c.hotelTot.vacant}</td>
              <td>{pct(c.hotelTot.occ, 2)}</td>
              <td>{c.hotelTot.inHouse}</td>
              <td>{c.hotelTot.arrivals}</td>
              <td>{c.hotelTot.departures}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <Section title="2. NEXT 7 DAYS OCCUPANCY FORECAST — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
              <th className="wide">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rep.hotels.map((h, i) => (
              <tr key={i}>
                <Label>{h.name}</Label>
                {h.forecast.map((v, d) => (
                  <NumIn
                    key={d}
                    value={v}
                    suffix="%"
                    onChange={(nv) => set.hotel(i, { forecast: h.forecast.map((x, k) => (k === d ? nv ?? 0 : x)) })}
                  />
                ))}
                <TextIn value={h.forecastNotes} onChange={(v) => set.hotel(i, { forecastNotes: v })} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="3. FOOD & BEVERAGE — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel / Outlet</th>
              <th title="Breakfast + lunch + dinner covers">Total Guests Served</th>
              <th>Breakfast Covers</th>
              <th>Lunch Covers</th>
              <th>Dinner Covers</th>
              <th className="wide">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rep.outlets.map((o, i) => (
              <tr key={i}>
                <Label>{o.name}</Label>
                <Calc>{c.outlets[i].covers}</Calc>
                <NumIn value={o.breakfast} onChange={(v) => set.outlet(i, { breakfast: v ?? 0 })} />
                <NumIn value={o.lunch} onChange={(v) => set.outlet(i, { lunch: v ?? 0 })} />
                <NumIn value={o.dinner} onChange={(v) => set.outlet(i, { dinner: v ?? 0 })} />
                <TextIn value={o.remarks} onChange={(v) => set.outlet(i, { remarks: v })} />
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL — ALL OUTLETS</td>
              <td>{c.outletTot.guestsServed}</td>
              <td>{c.outletTot.breakfast}</td>
              <td>{c.outletTot.lunch}</td>
              <td>{c.outletTot.dinner}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <Section title="4. DIVING — FUVAHMULAH SCUBA CLUB — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              <th>In-House Divers</th>
              <th>Free/Walk-in Divers</th>
              <th>Total Courses</th>
              <th>Dhoni Trips /Day</th>
              <th>Divers on Dhoni</th>
              <th>Snorkel Trips</th>
              <th className="wide">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rep.dive.map((d, i) => (
              <tr key={i}>
                <Label>{d.name}</Label>
                <NumIn value={d.inHouseDivers} onChange={(v) => set.dive(i, { inHouseDivers: v ?? 0 })} />
                <NumIn value={d.walkInDivers} onChange={(v) => set.dive(i, { walkInDivers: v ?? 0 })} />
                <NumIn value={d.courses} onChange={(v) => set.dive(i, { courses: v ?? 0 })} />
                <NumIn value={d.dhoniTrips} onChange={(v) => set.dive(i, { dhoniTrips: v ?? 0 })} />
                <NumIn value={d.diversOnDhoni} onChange={(v) => set.dive(i, { diversOnDhoni: v ?? 0 })} />
                <NumIn value={d.snorkelTrips} onChange={(v) => set.dive(i, { snorkelTrips: v ?? 0 })} />
                <TextIn value={d.remarks} onChange={(v) => set.dive(i, { remarks: v })} />
              </tr>
            ))}
            <tr className="total">
              <td>TOTAL — ALL HOTELS</td>
              <td>{c.diveTot.inHouseDivers}</td>
              <td>{c.diveTot.walkInDivers}</td>
              <td>{c.diveTot.courses}</td>
              <td>{c.diveTot.dhoniTrips}</td>
              <td>{c.diveTot.diversOnDhoni}</td>
              <td>{c.diveTot.snorkelTrips}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <Section title="5. SPECIAL OCCASIONS & GUEST REMARKS — HOTEL-WISE" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Hotel</th>
              <th className="wide">Room / Guest Name</th>
              <th className="wide">Occasion / Remark</th>
              <th className="wide">Action Taken / Notes</th>
              <th className="tools screen-only" />
            </tr>
          </thead>
          <tbody>
            {rep.occasions.map((o, i) => (
              <tr key={i} className="tall">
                <TextIn value={o.hotel} onChange={(v) => setOcc(i, { hotel: v })} className="lbl" />
                <TextIn value={o.guest} onChange={(v) => setOcc(i, { guest: v })} />
                <TextIn value={o.occasion} onChange={(v) => setOcc(i, { occasion: v })} multiline />
                <TextIn value={o.action} onChange={(v) => setOcc(i, { action: v })} multiline />
                <RowTools onRemove={() => update((r) => ({ ...r, occasions: r.occasions.filter((_, j) => j !== i) }))} />
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="add screen-only"
          onClick={() =>
            update((r) => ({
              ...r,
              occasions: [...r.occasions, { hotel: r.hotels[0]?.name ?? '', guest: '', occasion: '', action: '' }],
            }))
          }
        >
          + Add occasion / remark
        </button>
      </div>

      <Section title="STAFF DUTY ROSTER — SHIFT & TIME" />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th className="wide">Department / Property</th>
              <th className="wide">Staff Name(s) on Duty</th>
              <th>Role</th>
              <th>Shift</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th className="wide">Notes</th>
              <th className="tools screen-only" />
            </tr>
          </thead>
          <tbody>
            {rep.roster.map((s, i) => (
              <tr key={i} className="tall">
                <TextIn value={s.dept} onChange={(v) => setRoster(i, { dept: v })} className="lbl" multiline />
                <TextIn value={s.staff} onChange={(v) => setRoster(i, { staff: v })} multiline />
                <TextIn value={s.role} onChange={(v) => setRoster(i, { role: v })} />
                <TextIn value={s.shift} onChange={(v) => setRoster(i, { shift: v })} className="center" />
                <TextIn value={s.timeIn} onChange={(v) => setRoster(i, { timeIn: v })} className="center" />
                <TextIn value={s.timeOut} onChange={(v) => setRoster(i, { timeOut: v })} className="center" />
                <TextIn value={s.notes} onChange={(v) => setRoster(i, { notes: v })} />
                <RowTools onRemove={() => update((r) => ({ ...r, roster: r.roster.filter((_, j) => j !== i) }))} />
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="add screen-only"
          onClick={() =>
            update((r) => ({
              ...r,
              roster: [...r.roster, { dept: '', staff: '', role: '', shift: 'Morning', timeIn: '', timeOut: '', notes: '' }],
            }))
          }
        >
          + Add roster line
        </button>
      </div>
    </div>
  );
}
