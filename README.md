# Cozy Hotel Daily Reports

A web app that builds the two reports presented to management every day:

1. **Daily Operations Report**: occupancy, 7‑day forecast, F&B covers, diving, special occasions, staff roster.
2. **Daily Financial Report**: built from the operations numbers, plus room revenue, F&B/dive rates and bar/other revenue.

The layout follows the existing Excel sheets: **yellow cells are filled in daily**, **grey cells are calculated**.

## Daily workflow

1. Pick the **report date** (in the header, or in the Report Date cell on either report) and click **Start report from <previous day>**. Hotels, roster, rates, remarks and
   projected ADR are carried over; the 7‑day forecast moves forward one day; today's counts start at zero.
2. Fill in the **Operations report** tab. Complimentary rooms go in **FOC Rooms**: they count as occupied
   (occupancy %) but are excluded from room revenue and ADR on the financial report.
3. Open the **Financial report** tab. Occupancy, in‑house guests, covers, dives and the forecast are already filled
   in from operations. Room revenue fills in as occupied rooms × room rate (type a figure to override it).
   Enter bar/other revenue, the reef/tiger split of the dives and
   equipment rentals. A ⚠ appears when the dive split doesn't match the operations report.
   If a group's diving revenue needs to be entered by hand, type it in **Override revenue**.
4. Click **Print / PDF** (Operations, Financial or Both) and choose *Save as PDF* to share with management. Each
   report is automatically scaled (width and height) to fit on one A4 page (Both = two pages, one per report).

Under **Setup** you can set the **room rate per hotel**, the **meal rates** (breakfast/lunch/dinner per pax) and the
**diving rates**, and rename, add or remove hotels, outlets and dive groups. Rates carry forward to every new day.

## Data storage (shared)

Reports are stored in a private **Vercel Blob** store (`dailyreport-store`), so every device sees the same reports.

- Staff sign in once per device with the team passcode (Vercel env var `APP_PASSCODE`). To change it: Vercel →
  project `dailyreport` → Settings → Environment Variables → edit `APP_PASSCODE`, then redeploy.
- Edits are kept on the device immediately and saved to the cloud ~15 seconds after you stop typing, when you switch
  away from the page, or when you press **Save now**. The header shows *Saved to cloud* / *Unsaved changes*.
- If two devices edit the same day at once, the second one to save is asked which version to keep. Nothing is
  overwritten silently.
- Without internet, edits stay on the device and upload once the connection is back.
- **Setup → Download backup** still exports every report to a JSON file for safekeeping.

API routes (`/api`): `GET /api/reports`, `GET|PUT|DELETE /api/report?date=YYYY-MM-DD`, all requiring the
`x-passcode` header.

## Calculations

| Figure | Formula |
| --- | --- |
| Paid rooms | Occupied rooms − FOC rooms |
| Room revenue | Paid rooms × room rate (unless overridden) |
| Vacant rooms | Total rooms − occupied |
| Occ. % | Occupied rooms (incl. FOC) ÷ total rooms |
| ADR | Room revenue ÷ paid rooms |
| Total guests served | Breakfast + lunch + dinner covers |
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
