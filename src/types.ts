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
  roomRate: number; // nightly rate per occupied room (set in Setup)
  roomRevenue: number | null; // null = auto (occupied × room rate)
  projAdr: number;
  finRemarks: string;
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
  barOther: number;
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
  reviewedBy: string;
  updatedAt: string;
}
