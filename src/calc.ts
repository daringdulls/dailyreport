import type { DailyReport, DiveRow, HotelRow, OutletRow } from './types';

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const div = (a: number, b: number) => (b ? a / b : 0);

export function outletCovers(o: OutletRow) {
  return (o.breakfast || 0) + (o.lunch || 0) + (o.dinner || 0);
}

export function outletRevenue(o: OutletRow, r: DailyReport['fnbRates']) {
  // F&B revenue = covers × allocated meal rates (bar/other revenue is no longer part of the report)
  return o.breakfast * r.breakfast + o.lunch * r.lunch + o.dinner * r.dinner;
}

export const DEFAULT_DIVE_RULE = { reef: 2, tiger: 1 };
export const diveRuleOf = (rep: Pick<DailyReport, 'diveRule'>) => rep.diveRule ?? DEFAULT_DIVE_RULE;

/** Reef/tiger dives by the daily rule (each diver: rule.reef reef dives + rule.tiger tiger dives). */
export function ruleSplit(d: DiveRow, rule: DailyReport['diveRule'] = DEFAULT_DIVE_RULE) {
  const r = rule ?? DEFAULT_DIVE_RULE;
  return {
    reefIn: (d.inHouseDivers || 0) * r.reef,
    tigerIn: (d.inHouseDivers || 0) * r.tiger,
    reefWalk: (d.walkInDivers || 0) * r.reef,
    tigerWalk: (d.walkInDivers || 0) * r.tiger,
  };
}

/**
 * Price per in-house diver per day. Reports saved before per-person pricing use the old
 * per-dive prices × the daily rule (2 × $55 + 1 × $65 = $175), so their totals don't change.
 */
export function inHousePersonRate(r: DailyReport['diveRates'], rule?: DailyReport['diveRule']) {
  if (r.inHousePerson != null) return r.inHousePerson;
  const x = rule ?? DEFAULT_DIVE_RULE;
  return x.reef * (r.reefIn || 0) + x.tiger * (r.tigerIn || 0);
}

/** The split used for revenue: hand-edited figures if the row was edited, otherwise the rule. */
export function diveSplit(d: DiveRow, rule?: DailyReport['diveRule']) {
  if (d.splitManual) return { reefIn: d.reefIn || 0, tigerIn: d.tigerIn || 0, reefWalk: d.reefWalk || 0, tigerWalk: d.tigerWalk || 0 };
  return ruleSplit(d, rule);
}

export function diveCalcRevenue(d: DiveRow, r: DailyReport['diveRates'], rule?: DailyReport['diveRule']) {
  const s = diveSplit(d, rule);
  return (
    // in-house: per person per day; walk-in: per dive (reef / tiger)
    (d.inHouseDivers || 0) * inHousePersonRate(r, rule) +
    s.reefWalk * r.reefWalk +
    s.tigerWalk * r.tigerWalk +
    d.courses * r.course +
    d.dhoniTrips * r.dhoni +
    d.equipRentals * r.equip
  );
}

export function diveRevenue(d: DiveRow, r: DailyReport['diveRates'], rule?: DailyReport['diveRule']) {
  return d.revenueOverride != null ? d.revenueOverride : diveCalcRevenue(d, r, rule);
}

/** Rooms that pay: occupied minus complimentary (FOC) rooms. */
export const paidRooms = (h: HotelRow) => Math.max(0, (h.occupied || 0) - (h.foc || 0));
/** Paid rooms sold at the other rates (local, agent…). */
export const otherRateRooms = (h: HotelRow) => (h.otherRates ?? []).reduce((a, r) => a + (r.rooms || 0), 0);
/** Paid rooms charged at the standard rate = paid rooms not covered by another rate. */
export const standardRooms = (h: HotelRow) => Math.max(0, paidRooms(h) - otherRateRooms(h));
const cents = (n: number) => Math.round(n * 100) / 100;
export const autoRoomRevenue = (h: HotelRow) =>
  cents(
    standardRooms(h) * (h.roomRate || 0) +
      (h.otherRates ?? []).reduce((a, r) => a + (r.rooms || 0) * (r.rate || 0), 0),
  );
/**
 * A figure typed into Room Revenue overrides the rates. Blank or 0 means "use the rates":
 * older reports saved 0 by default, and free rooms are recorded as FOC instead.
 */
export const manualRoomRevenue = (h: HotelRow) => (h.roomRevenue ? h.roomRevenue : null);
export const roomRevenue = (h: HotelRow) => manualRoomRevenue(h) ?? autoRoomRevenue(h);

/**
 * Room & guest movements: tonight = last night + arrivals − departures.
 * Keeps `occupied` (rooms tonight) and `inHouse` (guests tonight) in sync. Reports
 * saved before movements existed get a "last night" figure that keeps their totals.
 */
export function normalizeHotel(h: HotelRow): HotelRow {
  const arr = h.arrivals || 0;
  const dep = h.departures || 0;
  const ag = h.arrivalGuests || 0;
  const dg = h.departureGuests || 0;
  const startRooms = h.startRooms ?? Math.max(0, (h.occupied || 0) - arr + dep);
  const startGuests = h.startGuests ?? Math.max(0, (h.inHouse || 0) - ag + dg);
  return {
    ...h,
    startRooms,
    startGuests,
    occupied: Math.max(0, startRooms + arr - dep),
    inHouse: Math.max(0, startGuests + ag - dg),
  };
}
export const normalizeReport = (rep: DailyReport): DailyReport => ({ ...rep, hotels: rep.hotels.map(normalizeHotel) });

/** Every auto-calculated (grey) number for both reports. */
export function compute(rep: DailyReport) {
  const hotels = rep.hotels.map((h) => ({
    vacant: Math.max(0, h.totalRooms - h.occupied),
    occ: div(h.occupied, h.totalRooms),
    paid: paidRooms(h),
    focError: (h.foc || 0) > (h.occupied || 0),
    // more rooms/guests leaving than were in house, or more rooms occupied than exist
    moveError:
      (h.departures || 0) > (h.startRooms || 0) ||
      (h.departureGuests || 0) > (h.startGuests || 0) ||
      (h.startRooms || 0) + (h.arrivals || 0) - (h.departures || 0) > h.totalRooms,
    rateError: otherRateRooms(h) > paidRooms(h),
    revenue: roomRevenue(h),
    // ADR is revenue per paying room, so FOC rooms don't drag it down
    adr: div(roomRevenue(h), paidRooms(h)),
    revpar: div(roomRevenue(h), h.totalRooms),
  }));
  const hotelTotals = {
    totalRooms: sum(rep.hotels.map((h) => h.totalRooms)),
    occupied: sum(rep.hotels.map((h) => h.occupied)),
    foc: sum(rep.hotels.map((h) => h.foc || 0)),
    paid: sum(rep.hotels.map(paidRooms)),
    inHouse: sum(rep.hotels.map((h) => h.inHouse)),
    arrivals: sum(rep.hotels.map((h) => h.arrivals)),
    departures: sum(rep.hotels.map((h) => h.departures)),
    startRooms: sum(rep.hotels.map((h) => h.startRooms || 0)),
    startGuests: sum(rep.hotels.map((h) => h.startGuests || 0)),
    arrivalGuests: sum(rep.hotels.map((h) => h.arrivalGuests || 0)),
    departureGuests: sum(rep.hotels.map((h) => h.departureGuests || 0)),
    roomRevenue: sum(rep.hotels.map(roomRevenue)),
  };
  const hotelTot = {
    ...hotelTotals,
    vacant: hotelTotals.totalRooms - hotelTotals.occupied,
    occ: div(hotelTotals.occupied, hotelTotals.totalRooms),
    adr: div(hotelTotals.roomRevenue, hotelTotals.paid),
    revpar: div(hotelTotals.roomRevenue, hotelTotals.totalRooms),
  };

  const outlets = rep.outlets.map((o) => {
    const covers = outletCovers(o);
    const revenue = outletRevenue(o, rep.fnbRates);
    return { covers, revenue, avgSpend: div(revenue, covers) };
  });
  const outletTot = {
    guestsServed: sum(rep.outlets.map(outletCovers)),
    breakfast: sum(rep.outlets.map((o) => o.breakfast)),
    lunch: sum(rep.outlets.map((o) => o.lunch)),
    dinner: sum(rep.outlets.map((o) => o.dinner)),
    covers: sum(outlets.map((o) => o.covers)),
    revenue: sum(outlets.map((o) => o.revenue)),
  };

  const rule = diveRuleOf(rep);
  const dive = rep.dive.map((d) => {
    const split = diveSplit(d, rule);
    const byRule = ruleSplit(d, rule);
    return {
      split,
      byRule,
      finInHouse: d.inHouseDivers || 0, // in-house divers (persons), charged per person
      finWalk: split.reefWalk + split.tigerWalk,
      revenue: diveRevenue(d, rep.diveRates, rule),
      calcRevenue: diveCalcRevenue(d, rep.diveRates, rule),
      // hand-edited split that no longer matches the divers × daily rule
      mismatch:
        !!d.splitManual &&
        (split.reefWalk !== byRule.reefWalk ||
          split.tigerWalk !== byRule.tigerWalk),
    };
  });
  const k = <K extends keyof DiveRow>(key: K) => sum(rep.dive.map((d) => d[key] as number));
  const diveTot = {
    inHouseDivers: k('inHouseDivers'),
    walkInDivers: k('walkInDivers'),
    courses: k('courses'),
    dhoniTrips: k('dhoniTrips'),
    diversOnDhoni: k('diversOnDhoni'),
    snorkelTrips: k('snorkelTrips'),
    equipRentals: k('equipRentals'),
    finInHouse: sum(dive.map((d) => d.finInHouse)),
    finWalk: sum(dive.map((d) => d.finWalk)),
    revenue: sum(dive.map((d) => d.revenue)),
  };

  const totalRevenue = hotelTot.roomRevenue + outletTot.revenue + diveTot.revenue;
  const summary = [
    { label: 'Rooms Revenue (All Hotels)', amount: hotelTot.roomRevenue },
    { label: 'Food & Beverage Revenue', amount: outletTot.revenue },
    { label: 'Diving Revenue', amount: diveTot.revenue },
  ].map((s) => ({ ...s, pct: div(s.amount, totalRevenue) }));

  return { hotels, hotelTot, outlets, outletTot, dive, diveTot, summary, totalRevenue };
}

export type Computed = ReturnType<typeof compute>;

// ---------- formatting ----------
export const money = (n: number, cur = 'USD') => {
  const sym = cur === 'USD' ? '$' : cur === 'MVR' ? 'MVR ' : cur + ' ';
  const v = Math.round(n * 100) / 100;
  return sym + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
export const pct = (n: number, d = 1) => (n * 100).toFixed(d) + '%';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toIso(dt: Date) {
  return dt.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  const dt = parseDate(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toIso(dt);
}
export function longDate(iso: string) {
  const dt = parseDate(iso);
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
export function forecastLabels(iso: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const dt = parseDate(addDays(iso, i + 1));
    return `${DAYS[dt.getUTCDay()]} ${String(dt.getUTCDate()).padStart(2, '0')}-${MONTHS[dt.getUTCMonth()]}`;
  });
}
