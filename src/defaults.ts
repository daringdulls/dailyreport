import type { DailyReport, DiveRow, HotelRow, OutletRow } from './types';
import { addDays } from './calc';

const hotel = (name: string, totalRooms: number): HotelRow => ({
  name,
  totalRooms,
  occupied: 0,
  foc: 0,
  inHouse: 0,
  arrivals: 0,
  departures: 0,
  remarks: 'All rooms in order; no complaints.',
  forecast: [0, 0, 0, 0, 0, 0, 0],
  forecastNotes: 'Confirmed + tentative bookings',
  roomRate: 0,
  roomRevenue: null,
  projAdr: 0,
  finRemarks: '',
});

export const blankOutlet = (name: string): OutletRow => ({
  name,
  guestsServed: 0,
  breakfast: 0,
  lunch: 0,
  dinner: 0,
  remarks: '',
  barOther: 0,
  finRemarks: '',
});

export const blankDive = (name: string): DiveRow => ({
  name,
  inHouseDivers: 0,
  walkInDivers: 0,
  courses: 0,
  dhoniTrips: 0,
  diversOnDhoni: 0,
  snorkelTrips: 0,
  remarks: '',
  reefIn: 0,
  tigerIn: 0,
  reefWalk: 0,
  tigerWalk: 0,
  equipRentals: 0,
  revenueOverride: null,
});

export const blankHotel = hotel;

/** First-ever report: structure, roster and rates taken from the 04-Oct-2026 sheets. */
export function seedReport(date: string): DailyReport {
  return {
    date,
    opsPreparedBy: 'Samam',
    shift: 'Morning',
    finPreparedBy: '',
    currency: 'USD',
    hotels: [
      { ...hotel('Cozy Roots Fuvahmulah', 11), roomRate: 55, projAdr: 22.5 },
      { ...hotel('Cozy Nest Fuvahmulah', 18), roomRate: 65, projAdr: 23.5 },
      { ...hotel('Cozy Art Dhangethi', 12), roomRate: 50, projAdr: 50 },
    ],
    outlets: [blankOutlet('Cozy Deck Fuvahmulah')],
    dive: ['Cozy Roots Fuvahmulah', 'Cozy Nest Fuvahmulah', 'Maathundi', 'Others'].map(blankDive),
    occasions: ['Cozy Nest Fuvahmulah', 'Cozy Roots Fuvahmulah', 'Cozy Art Dhangethi'].map((h) => ({
      hotel: h,
      guest: '',
      occasion: '',
      action: '',
    })),
    roster: [
      { dept: 'Cozy Roots Fuvahmulah — Housekeeping', staff: 'Mustafa', role: 'HK Attendant', shift: 'Morning', timeIn: '9:00 AM', timeOut: '6:00 PM', notes: '' },
      { dept: 'Cozy Nest Fuvahmulah — Housekeeping', staff: 'Ahmed', role: 'HK Supervisor', shift: 'Morning', timeIn: '9:00 AM', timeOut: '6:00 PM', notes: '' },
      { dept: 'Cozy Nest Fuvahmulah — Housekeeping', staff: 'Ramjan', role: 'HK Attendant', shift: 'Morning', timeIn: '9:00 AM', timeOut: '6:00 PM', notes: '' },
      { dept: 'Reservations — All Hotels', staff: 'Zaara', role: 'Executive', shift: 'Morning', timeIn: '11:00 AM', timeOut: '8:00 PM', notes: '' },
      { dept: 'Reservations — All Hotels', staff: 'Samam', role: 'Executive', shift: 'Morning', timeIn: '9:00 AM', timeOut: '6:00 PM', notes: '' },
      { dept: 'F&B — Kitchen', staff: 'Ash / Sujeewa', role: 'Chef', shift: '', timeIn: 'DEPEND ON MEAL TIME', timeOut: '', notes: '' },
      { dept: 'F&B — Servers', staff: 'Tjay, Bintang', role: 'Server', shift: 'Morning', timeIn: '6:00', timeOut: '15:00', notes: '' },
      { dept: 'F&B — Servers', staff: 'Sujan, Cristine, Tejay', role: 'Server', shift: 'Evening', timeIn: '15:00', timeOut: '23:00', notes: '' },
      { dept: 'Diving — Dive Center', staff: 'Alham, Sajidh, Safdhar, Allan, Nivedh, Shabbe, Kesley, Rilley, Maththu, Nagilu, Pabukko, Hassan, Rasel, Lotib, Yasin', role: 'Dive', shift: 'Morning', timeIn: '7:00', timeOut: '13:30', notes: '' },
    ],
    fnbRates: { breakfast: 8, lunch: 10, dinner: 12 },
    diveRates: { reefIn: 55, tigerIn: 65, reefWalk: 50, tigerWalk: 61, course: 450, dhoni: 0, equip: 30 },
    diveRule: { reef: 2, tiger: 1 },
    reviewedBy: '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Start the next day from the previous report: keeps structure, roster, rates,
 * remarks and projected ADR; clears the daily counts; shifts the 7-day forecast
 * one day forward so only the new last day needs typing.
 */
export function nextDayFrom(prev: DailyReport, date: string): DailyReport {
  const gap = Math.max(1, Math.round((Date.parse(date) - Date.parse(prev.date)) / 86400000));
  const shift = (f: number[]) => [...f.slice(gap), ...Array(Math.min(7, gap)).fill(0)].slice(0, 7);
  return {
    ...structuredClone(prev),
    date,
    hotels: prev.hotels.map((h) => ({
      ...hotel(h.name, h.totalRooms),
      remarks: h.remarks,
      forecastNotes: h.forecastNotes,
      projAdr: h.projAdr,
      roomRate: h.roomRate ?? 0,
      availabilityName: h.availabilityName,
      otherRates: (h.otherRates ?? []).map((r) => ({ ...r, rooms: 0 })),
      // tomorrow's forecast becomes today's starting point for occupancy
      forecast: shift(h.forecast),
    })),
    outlets: prev.outlets.map((o) => blankOutlet(o.name)),
    dive: prev.dive.map((d) => blankDive(d.name)),
    occasions: prev.hotels.map((h) => ({ hotel: h.name, guest: '', occasion: '', action: '' })),
    roster: structuredClone(prev.roster),
    reviewedBy: '',
    availabilityImportedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export { addDays };
