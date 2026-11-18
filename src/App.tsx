import { useCallback, useEffect, useState, useRef } from 'react';
import type { DailyReport } from './types';
import { compute, longDate, money, pct, toIso } from './calc';
import { blankDive, blankHotel, blankOutlet, nextDayFrom, seedReport } from './defaults';
import { downloadJson, type Store } from './storage';
import { AuthError, fetchReport, getPasscode, listReports, setPasscode } from './cloud';
import { useCloudStore, type SyncStatus } from './sync';
import { fitPages, installPrintFit } from './fitToPage';
import OperationsReport from './reports/OperationsReport';
import FinancialReport from './reports/FinancialReport';

type Tab = 'ops' | 'fin' | 'setup';
type PrintTarget = 'ops' | 'fin' | 'both';

const localToday = () => {
  const d = new Date();
  return toIso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
};

export default function App() {
  const [signedIn, setSignedIn] = useState(() => !!getPasscode());
  const signOut = useCallback(() => {
    setPasscode('');
    setSignedIn(false);
  }, []);
  if (!signedIn) return <SignIn onDone={() => setSignedIn(true)} />;
  return <Reports onAuthFail={signOut} onSignOut={signOut} />;
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await listReports(code.trim());
      setPasscode(code.trim());
      onDone();
    } catch (x) {
      setErr(x instanceof AuthError ? 'That passcode is not right.' : 'Could not reach the server. Check the internet connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="signin">
      <form onSubmit={submit} className="card">
        <img src="/favicon.svg" alt="" width={40} height={40} />
        <h2>Cozy Hotel Daily Reports</h2>
        <p className="muted">Enter the team passcode to open the shared reports.</p>
        <input
          type="password"
          autoFocus
          value={code}
          placeholder="Passcode"
          onChange={(e) => setCode(e.target.value)}
        />
        {err && <p className="err">{err}</p>}
        <button className="primary" disabled={busy || !code.trim()}>
          {busy ? 'Checking…' : 'Open reports'}
        </button>
      </form>
    </main>
  );
}

function Reports({ onAuthFail, onSignOut }: { onAuthFail: () => void; onSignOut: () => void }) {
  const cloud = useCloudStore(true, onAuthFail);
  const { store, dates, index, indexLoaded } = cloud;
  const [date, setDate] = useState<string>(localToday);
  const [pickedDate, setPickedDate] = useState(false);
  const [tab, setTab] = useState<Tab>('ops');
  const [printTarget, setPrintTarget] = useState<PrintTarget>('both');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(installPrintFit, []);

  // open the latest report once the list has loaded (unless the user already picked a date)
  useEffect(() => {
    if (indexLoaded && !pickedDate && dates.length) setDate(dates[dates.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexLoaded]);

  const { ensureLoaded } = cloud;
  useEffect(() => {
    if (indexLoaded) void ensureLoaded(date);
  }, [date, indexLoaded, index[date]?.etag, ensureLoaded]);

  const pick = (d: string) => {
    if (!d) return;
    setPickedDate(true);
    setDate(d);
  };

  const rep = store[date];
  const inCloudNotLoaded = !rep && !!index[date];

  const update = (fn: (r: DailyReport) => DailyReport) => {
    const cur = store[date];
    if (cur) cloud.put(date, fn(cur));
  };

  const previous = dates.filter((d) => d < date).pop();

  const createReport = async (mode: 'carry' | 'blank') => {
    let prevRep = previous ? store[previous] : undefined;
    if (mode === 'carry' && previous && !prevRep) {
      try {
        prevRep = (await fetchReport(previous)).report;
      } catch {
        alert('Could not load the previous day from the cloud. Check the connection and try again.');
        return;
      }
    }
    const r = mode === 'carry' && prevRep ? nextDayFrom(prevRep, date) : seedReport(date);
    cloud.put(date, r);
  };

  const doPrint = (t: PrintTarget) => {
    setPrintTarget(t);
    const prevTitle = document.title;
    // the browser uses the page title as the PDF file name
    const name =
      t === 'ops' ? 'Daily Operation Report' : t === 'fin' ? 'Daily Finance Report' : 'Daily Operation & Finance Report';
    document.title = `${name} ${longDate(date)}`;
    setTimeout(() => {
      fitPages(); // also runs on 'beforeprint'; calling it here covers browsers without that event
      window.print();
      document.title = prevTitle;
    }, 50);
  };

  const removeReport = () => {
    if (!confirm(`Delete the report for ${longDate(date)} for everyone? This cannot be undone.`)) return;
    void cloud.remove(date);
  };

  const backup = async () => {
    // make sure every date is in the backup, not only those opened on this device
    const all: Store = { ...store };
    for (const d of dates) {
      if (!all[d]) {
        try {
          all[d] = (await fetchReport(d)).report;
        } catch {
          /* skip */
        }
      }
    }
    downloadJson(`cozy-reports-backup-${localToday()}.json`, all);
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Store;
      const count = Object.keys(data).length;
      if (!confirm(`Restore ${count} report(s) from backup? Reports with the same date will be replaced for everyone.`))
        return;
      for (const [d, r] of Object.entries(data)) cloud.put(d, r);
    } catch {
      alert('That file is not a valid backup.');
    }
  };

  const c = rep ? compute(rep) : null;

  return (
    <div className={`app print-${printTarget}`}>
      <header className="bar screen-only">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <div>
            <strong>Cozy Hotel Daily Reports</strong>
            <small>Operations → Financial report builder</small>
          </div>
        </div>
        <div className="controls">
          <label className="date">
            Report date
            <input type="date" value={date} onChange={(e) => pick(e.target.value)} />
          </label>
          <select value={dates.includes(date) ? date : ''} onChange={(e) => pick(e.target.value)}>
            <option value="">Saved reports ({dates.length})</option>
            {[...dates].reverse().map((d) => (
              <option key={d} value={d}>
                {longDate(d)}
              </option>
            ))}
          </select>
          <SyncBadge status={cloud.status} dirty={cloud.dirtyCount} />
          <button onClick={cloud.saveAllDirty} disabled={!cloud.dirtyCount} title="Save to the cloud now">
            Save now
          </button>
          <button onClick={() => void cloud.refreshIndex()} title="Get the latest reports from the cloud">
            ↻ Refresh
          </button>
        </div>
      </header>

      {cloud.conflict && (
        <div className="conflict screen-only">
          <b>The {longDate(cloud.conflict)} report was changed on another device while you were editing it.</b>
          <span>Choose which version to keep:</span>
          <button onClick={() => void cloud.resolveConflict('theirs')}>Load the other device's version</button>
          <button className="primary" onClick={() => void cloud.resolveConflict('mine')}>
            Keep my version
          </button>
        </div>
      )}

      {!rep ? (
        <main className="empty screen-only">
          {!indexLoaded || inCloudNotLoaded ? (
            <h2 className="muted">Loading reports…</h2>
          ) : (
            <>
              <h2>No report for {longDate(date)} yet</h2>
              {previous ? (
                <>
                  <p>
                    Start from <b>{longDate(previous)}</b>: hotels, rates, roster and remarks are carried over, the
                    forecast moves forward a day, and today's counts start at zero.
                  </p>
                  <button className="primary" onClick={() => void createReport('carry')}>
                    Start report from {longDate(previous)}
                  </button>
                  <button onClick={() => void createReport('blank')}>Start from the default template</button>
                </>
              ) : (
                <>
                  <p>Start with the default template (3 hotels, Cozy Deck outlet, dive groups, roster and rates).</p>
                  <button className="primary" onClick={() => void createReport('blank')}>
                    Create report
                  </button>
                </>
              )}
              <p className="muted">
                Have a backup file?{' '}
                <button className="link" onClick={() => fileRef.current?.click()}>
                  Restore backup
                </button>
              </p>
            </>
          )}
        </main>
      ) : (
        <>
          <section className="kpis screen-only">
            <Kpi label="Occupancy" value={pct(c!.hotelTot.occ)} sub={`${c!.hotelTot.occupied} / ${c!.hotelTot.totalRooms} rooms${c!.hotelTot.foc ? ` · ${c!.hotelTot.foc} FOC` : ''}`} />
            <Kpi label="In-house guests" value={String(c!.hotelTot.inHouse)} sub={`${c!.hotelTot.arrivals} arr · ${c!.hotelTot.departures} dep`} />
            <Kpi label="ADR (paid rooms)" value={money(c!.hotelTot.adr, rep.currency)} sub={`RevPAR ${money(c!.hotelTot.revpar, rep.currency)}`} />
            <Kpi label="F&B revenue" value={money(c!.outletTot.revenue, rep.currency)} sub={`${c!.outletTot.covers} covers`} />
            <Kpi label="Diving revenue" value={money(c!.diveTot.revenue, rep.currency)} sub={`${c!.diveTot.inHouseDivers + c!.diveTot.walkInDivers} divers`} />
            <Kpi label="Total revenue" value={money(c!.totalRevenue, rep.currency)} sub="all business units" strong />
          </section>

          <nav className="tabs screen-only">
            <button className={tab === 'ops' ? 'on' : ''} onClick={() => setTab('ops')}>
              1 · Operations report
            </button>
            <button className={tab === 'fin' ? 'on' : ''} onClick={() => setTab('fin')}>
              2 · Financial report
            </button>
            <button className={tab === 'setup' ? 'on' : ''} onClick={() => setTab('setup')}>
              Setup
            </button>
            <span className="spacer" />
            <button onClick={() => doPrint('ops')}>Print / PDF: Operations</button>
            <button onClick={() => doPrint('fin')}>Print / PDF: Financial</button>
            <button className="primary" onClick={() => doPrint('both')}>
              Print / PDF: Both
            </button>
          </nav>

          <main>
            <div className={`page ops ${tab === 'ops' ? '' : 'hide-screen'}`}>
              <OperationsReport rep={rep} update={update} onPickDate={pick} />
            </div>
            <div className={`page fin ${tab === 'fin' ? '' : 'hide-screen'}`}>
              <FinancialReport rep={rep} update={update} onPickDate={pick} />
            </div>
            {tab === 'setup' && (
              <Setup
                rep={rep}
                update={update}
                onBackup={() => void backup()}
                onRestore={() => fileRef.current?.click()}
                onDelete={removeReport}
                onSignOut={onSignOut}
              />
            )}
          </main>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function SyncBadge({ status, dirty }: { status: SyncStatus; dirty: number }) {
  if (status.kind === 'offline')
    return (
      <span className="saved err" title={status.message}>
        ● Not synced: kept on this device{dirty ? ` (${dirty} unsaved)` : ''}
      </span>
    );
  if (status.kind === 'saving') return <span className="saved busy">● Saving…</span>;
  if (status.kind === 'loading') return <span className="saved busy">● Loading…</span>;
  if (dirty) return <span className="saved busy">● Unsaved changes</span>;
  return <span className="saved ok">● Saved to cloud</span>;
}

function Kpi({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={`kpi ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function RateRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="row rate">
      <span>{label}</span>
      <span className="muted">$</span>
      <input
        type="number"
        className="short"
        step={0.5}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function Setup({
  rep,
  update,
  onBackup,
  onRestore,
  onDelete,
  onSignOut,
}: {
  rep: DailyReport;
  update: (fn: (r: DailyReport) => DailyReport) => void;
  onBackup: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSignOut: () => void;
}) {
  const renameIn = <T extends { name: string }>(list: T[], i: number, name: string) =>
    list.map((x, j) => (j === i ? { ...x, name } : x));
  const setRates = (i: number, fn: (rs: NonNullable<DailyReport['hotels'][number]['otherRates']>) => typeof rs) =>
    update((r) => ({ ...r, hotels: r.hotels.map((x, j) => (j === i ? { ...x, otherRates: fn(x.otherRates ?? []) } : x)) }));
  const setOther = (i: number, k: number, p: { name?: string; rate?: number }) =>
    setRates(i, (rs) => rs.map((o, j) => (j === k ? { ...o, ...p } : o)));
  const removeOther = (i: number, k: number) => setRates(i, (rs) => rs.filter((_, j) => j !== k));
  const addOther = (i: number) =>
    setRates(i, (rs) => [...rs, { name: 'Local', rate: rep.hotels[i]?.roomRate ?? 0, rooms: 0 }]);

  return (
    <div className="setup">
      <p className="muted">
        Changes here apply to the {longDate(rep.date)} report and are carried into every new day you start from it.
      </p>
      <div className="grid">
        <div className="card">
          <h3>Hotels</h3>
          {rep.hotels.map((h, i) => (
            <div className="hotel" key={i}>
             <div className="row">
              <input value={h.name} onChange={(e) => update((r) => ({ ...r, hotels: renameIn(r.hotels, i, e.target.value) }))} />
              <button className="icon" title="Remove hotel" onClick={() => update((r) => ({ ...r, hotels: r.hotels.filter((_, j) => j !== i) }))}>
                ×
              </button>
             </div>
             <div className="row sub">
              <input
                type="number"
                className="short"
                title="Total rooms"
                value={h.totalRooms}
                onChange={(e) =>
                  update((r) => ({
                    ...r,
                    hotels: r.hotels.map((x, j) => (j === i ? { ...x, totalRooms: Number(e.target.value) || 0 } : x)),
                  }))
                }
              />
              <span className="muted">rooms</span>
              <span className="muted">rate $</span>
              <input
                type="number"
                className="short"
                title="Room rate per night"
                value={h.roomRate ?? 0}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  update((r) => ({
                    ...r,
                    hotels: r.hotels.map((x, j) => (j === i ? { ...x, roomRate: Number(e.target.value) || 0 } : x)),
                  }))
                }
              />
             </div>
             {(h.otherRates ?? []).map((o, k) => (
              <div className="row sub other" key={k}>
               <input
                 value={o.name}
                 title="Rate name (e.g. Local)"
                 onChange={(e) => setOther(i, k, { name: e.target.value })}
               />
               <span className="muted">$</span>
               <input
                 type="number"
                 className="short"
                 title="Nightly rate"
                 value={o.rate}
                 onFocus={(e) => e.target.select()}
                 onChange={(e) => setOther(i, k, { rate: Number(e.target.value) || 0 })}
               />
               <button className="icon" title="Remove rate" onClick={() => removeOther(i, k)}>
                 ×
               </button>
              </div>
             ))}
             <button className="add small" onClick={() => addOther(i)}>
               + Other rate (local, agent…)
             </button>
            </div>
          ))}
          <button className="add" onClick={() => update((r) => ({ ...r, hotels: [...r.hotels, blankHotel('New hotel', 10)] }))}>
            + Add hotel
          </button>
        </div>
        <div className="card">
          <h3>Rates</h3>
          <p className="muted">
            Room revenue = paid rooms × standard rate, plus any rooms sold at a hotel's other rates (local, agent…),
            which you count in the Financial report. You can still type a different figure there.
          </p>
          <h4>Meals ($ / pax)</h4>
          {(
            [
              ['breakfast', 'Breakfast'],
              ['lunch', 'Lunch'],
              ['dinner', 'Dinner'],
            ] as const
          ).map(([k, label]) => (
            <RateRow
              key={k}
              label={label}
              value={rep.fnbRates[k]}
              onChange={(v) => update((r) => ({ ...r, fnbRates: { ...r.fnbRates, [k]: v } }))}
            />
          ))}
          <h4>Diving ($ avg.)</h4>
          {(
            [
              ['reefIn', 'Reef dive (in-house)'],
              ['tigerIn', 'Tiger dive (in-house)'],
              ['reefWalk', 'Reef dive (walk-in)'],
              ['tigerWalk', 'Tiger dive (walk-in)'],
              ['course', 'Course'],
              ['dhoni', 'Dhoni trip'],
              ['equip', 'Equipment rental'],
            ] as const
          ).map(([k, label]) => (
            <RateRow
              key={k}
              label={label}
              value={rep.diveRates[k]}
              onChange={(v) => update((r) => ({ ...r, diveRates: { ...r.diveRates, [k]: v } }))}
            />
          ))}
        </div>
        <div className="card">
          <h3>F&amp;B outlets</h3>
          {rep.outlets.map((o, i) => (
            <div className="row" key={i}>
              <input value={o.name} onChange={(e) => update((r) => ({ ...r, outlets: renameIn(r.outlets, i, e.target.value) }))} />
              <button className="icon" onClick={() => update((r) => ({ ...r, outlets: r.outlets.filter((_, j) => j !== i) }))}>
                ×
              </button>
            </div>
          ))}
          <button className="add" onClick={() => update((r) => ({ ...r, outlets: [...r.outlets, blankOutlet('New outlet')] }))}>
            + Add outlet
          </button>
        </div>
        <div className="card">
          <h3>Diving groups</h3>
          {rep.dive.map((d, i) => (
            <div className="row" key={i}>
              <input value={d.name} onChange={(e) => update((r) => ({ ...r, dive: renameIn(r.dive, i, e.target.value) }))} />
              <button className="icon" onClick={() => update((r) => ({ ...r, dive: r.dive.filter((_, j) => j !== i) }))}>
                ×
              </button>
            </div>
          ))}
          <button className="add" onClick={() => update((r) => ({ ...r, dive: [...r.dive, blankDive('New group')] }))}>
            + Add group
          </button>
        </div>
        <div className="card">
          <h3>Data</h3>
          <p className="muted">
            Reports are saved to the shared cloud store, so every device signed in with the passcode sees the same
            reports. You can still download a backup file for safekeeping.
          </p>
          <div className="row">
            <button onClick={onBackup}>Download backup</button>
            <button onClick={onRestore}>Restore backup</button>
          </div>
          <div className="row">
            <button className="danger" onClick={onDelete}>
              Delete this day's report
            </button>
            <button onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
