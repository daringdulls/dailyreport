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

export function diveCalcRevenue(d: DiveRow, r: DailyReport['diveRates']) {
  return (
    d.reefIn * r.reefIn +
    d.tigerIn * r.tigerIn +
    d.reefWalk * r.reefWalk +
    d.tigerWalk * r.tigerWalk +
    d.courses * r.course +
    d.dhoniTrips * r.dhoni +
    d.equipRentals * r.equip
  );
}

export function diveRevenue(d: DiveRow, r: DailyReport['diveRates']) {
  return d.revenueOverride != null ? d.revenueOverride : diveCalcRevenue(d, r);
}

/** Rooms that pay: occupied minus complimentary (FOC) rooms. */
export const paidRooms = (h: HotelRow) => Math.max(0, (h.occupied || 0) - (h.foc || 0));
/** Paid rooms sold at the other rates (local, agent…). */
export const otherRateRooms = (h: HotelRow) => (h.otherRates ?? []).reduce((a, r) => a + (r.rooms || 0), 0);
/** Paid rooms charged at the standard rate = paid rooms not covered by another rate. */
export const standardRooms = (h: HotelRow) => Math.max(0, paidRooms(h) - otherRateRooms(h));
export const autoRoomRevenue = (h: HotelRow) =>
  standardRooms(h) * (h.roomRate || 0) +
  (h.otherRates ?? []).reduce((a, r) => a + (r.rooms || 0) * (r.rate || 0), 0);
export const roomRevenue = (h: HotelRow) => (h.roomRevenue != null ? h.roomRevenue : autoRoomRevenue(h));

/** Every auto-calculated (grey) number for both reports. */
export function compute(rep: DailyReport) {
  const hotels = rep.hotels.map((h) => ({
    vacant: Math.max(0, h.totalRooms - h.occupied),
    occ: div(h.occupied, h.totalRooms),
    paid: paidRooms(h),
    focError: (h.foc || 0) > (h.occupied || 0),
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

  const dive = rep.dive.map((d) => ({
    finInHouse: d.reefIn + d.tigerIn,
    finWalk: d.reefWalk + d.tigerWalk,
    revenue: diveRevenue(d, rep.diveRates),
    calcRevenue: diveCalcRevenue(d, rep.diveRates),
    // the finance dive split should add up to the dives in the ops report
    mismatch:
      d.reefIn + d.tigerIn !== d.inHouseDivers || d.reefWalk + d.tigerWalk !== d.walkInDivers,
  }));
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
