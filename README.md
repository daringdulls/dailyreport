# Cozy Hotel Daily Reports

A web app that builds the two reports presented to management every day:

1. **Daily Operations Report**: occupancy, 7‑day forecast, F&B covers, diving, special occasions, staff roster.
2. **Daily Financial Report**: built from the operations numbers, plus room revenue, F&B/dive rates and bar/other revenue.

The layout follows the existing Excel sheets: **yellow cells are filled in daily**, **grey cells are calculated**.

## Daily workflow

1. Pick the **report date** and click **Start report from <previous day>**. Hotels, roster, rates, remarks and
   projected ADR are carried over; the 7‑day forecast moves forward one day; today's counts start at zero.
2. Fill in the **Operations report** tab.
3. Open the **Financial report** tab. Occupancy, in‑house guests, covers, dives and the forecast are already filled
   in from operations. Room revenue fills in as occupied rooms × room rate (type a figure to override it).
   Enter bar/other revenue, the reef/tiger split of the dives and
   equipment rentals. A ⚠ appears when the dive split doesn't match the operations report.
   If a group's diving revenue needs to be entered by hand, type it in **Override revenue**.
4. Click **Print / PDF** (Operations, Financial or Both) and choose *Save as PDF* to share with management.

Under **Setup** you can set the **room rate per hotel**, the **meal rates** (breakfast/lunch/dinner per pax) and the
**diving rates**, and rename, add or remove hotels, outlets and dive groups. Rates carry forward to every new day.

## Data storage

Reports are saved automatically in the browser (localStorage) on the device you use. Use **Setup → Download backup**
regularly, and **Restore backup** to move reports to another computer.

## Calculations

| Figure | Formula |
| --- | --- |
| Room revenue | Occupied rooms × room rate (unless overridden) |
| Vacant rooms | Total rooms − occupied |
| Occ. % | Occupied ÷ total rooms |
| ADR | Room revenue ÷ occupied rooms |
| RevPAR | Room revenue ÷ total rooms |
| F&B revenue | Breakfast × rate + lunch × rate + dinner × rate + bar/other |
| Avg. spend / guest | F&B revenue ÷ total covers |
| Diving revenue | Σ(dives × rate by type) + courses × course rate + dhoni trips × dhoni rate + rentals × rental rate (or the override) |
| Daily revenue | Rooms + F&B + Diving |

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Deployed on Vercel as a static Vite site (framework preset **Vite**, build `npm run build`, output `dist`).
