# Austin Park Facility Equity Explorer

A local-first, responsive public evidence explorer for aggregated Austin park use and final facility-equity model results.

## Local project

- Working branch: `feature/sdoh-explorers`
- Park Use Explorer: 237 approved park records
- Facility Equity Explorer: 168 complete population-group × facility × year combinations
- Public data: `public/data/park_summary_public.csv` and `public/data/facility_equity_evidence.csv`
- Individual park-facility quantities are published only as `None`, `Low`, `Medium`, or `High` availability categories; exact research counts are not included.
- No raw mobility, device, weekly, origin-destination, or intermediate analysis data are included.

## Run locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Validate

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
```

## Data and interpretation

The Park Use Explorer presents descriptive, park-level annual summaries. The Facility Equity Explorer presents sample-level coefficients from the fully adjusted fixed-effects model; coefficients are associations, not causal effects or individual park equity scores.

Citation DOI: https://doi.org/10.1016/j.ufug.2025.129249

This repository is prepared for local review. It is not merged to `main` or published.
