// One DailyReport holds everything for a single date. The Operations report is
// filled in first; the Financial report re-uses those numbers (occupancy,
// covers, dives, forecast) and only asks for the money-related inputs.

export interface HotelRow {
  name: string;
  totalRooms: number;
  // operations
  occupied: number; // includes FOC rooms
  foc: number; // complimentary (free of charge) rooms, counted as occupied but earn no revenue
  inHouse: number;
  arrivals: number;
  departures: number;
  remarks: string;
  forecast: number[]; // 7 values, occupancy % for the next 7 days
  forecastNotes: string;
  // finance
  roomRate: number; // standard nightly rate per paid room (set in Setup)
  /** Property name in the Pixel availability app, if it differs from `name`. */
  availabilityName?: string;
  /** Other rates (local, agent, long stay…). Rooms not listed here are charged at roomRate. */
  otherRates?: OtherRate[];
  roomRevenue: number | null; // null = auto (occupied × room rate)
  projAdr: number;
  finRemarks: string;
}

export interface OtherRate {
  name: string; // e.g. "Local"
  rate: number; // nightly rate
  rooms: number; // paid rooms sold at this rate today
}

export interface OutletRow {
  name: string;
  // operations
  guestsServed: number; // legacy: now always calculated as total covers
  breakfast: number;
  lunch: number;
  dinner: number;
  remarks: string;
  // finance
  barOther: number; // legacy, no longer shown or counted
  finRemarks: string;
}

export interface DiveRow {
  name: string;
  // operations
  inHouseDivers: number;
  walkInDivers: number;
  courses: number;
  dhoniTrips: number;
  diversOnDhoni: number;
  snorkelTrips: number;
  remarks: string;
  // finance: split of dives by type, used for revenue
  reefIn: number;
  tigerIn: number;
  reefWalk: number;
  tigerWalk: number;
  equipRentals: number;
  revenueOverride: number | null; // when set, replaces the calculated revenue
  /** true once the reef/tiger split was edited by hand; otherwise it follows the daily dive rule */
  splitManual?: boolean;
}

export interface OccasionRow {
  hotel: string;
  guest: string;
  occasion: string;
  action: string;
}

export interface RosterRow {
  dept: string;
  staff: string;
  role: string;
  shift: string;
  timeIn: string;
  timeOut: string;
  notes: string;
}

export interface FnbRates {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface DiveRule {
  reef: number;
  tiger: number;
}

export interface DiveRates {
  reefIn: number;
  tigerIn: number;
  reefWalk: number;
  tigerWalk: number;
  course: number;
  dhoni: number;
  equip: number;
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  opsPreparedBy: string;
  shift: string;
  finPreparedBy: string;
  currency: string;
  hotels: HotelRow[];
  outlets: OutletRow[];
  dive: DiveRow[];
  occasions: OccasionRow[];
  roster: RosterRow[];
  fnbRates: FnbRates;
  diveRates: DiveRates;
  /** Dives each diver does per day (default 2 reef + 1 tiger). Used to work out the reef/tiger split. */
  diveRule?: DiveRule;
  reviewedBy: string;
  /** When occupancy was last imported from the availability app (ISO time). */
  availabilityImportedAt?: string;
  updatedAt: string;
}
