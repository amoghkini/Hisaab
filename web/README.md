# Web

React + Vite + TypeScript, with MUI. The look follows ezBookkeeping's web app (see `THIRD_PARTY_NOTICES.md`).

## Run

Start the backend first (see `backend/README.md`), then:

```sh
cd web
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` to the backend on port 8000 (change it with `VITE_DEV_API`).

## Pages

- `/login`: log in.
- `/signup`: create an account in two steps (account details, then optional preset categories). This also logs you in.
- `/`: the dashboard, for signed-in users only. Anyone else is sent to `/login`. See "Dashboard" below.
- `/profile`: account details, preferences (currency, first day of week, amount colours) and the theme colour.

## Dashboard

A copy of ezBookkeeping's overview page: ten widgets on a 12-column grid (`src/pages/overview/layout.ts`), stacked on small screens.

The numbers are sample data for now. Each widget loads its own data through one call in `src/api/overview.ts`, which answers from `src/api/overviewSample.ts`. To connect a widget to the backend, build its endpoint (the path and response shape are in the comment above each call) and replace the call's body with `request(...)`. Delete `overviewSample.ts` once every call is connected.

Buttons that lead to pages not built yet (View Details, a day, a category) explain that the feature is coming.

## Theme colour

Each user picks their own primary colour on the profile page (default `#c67e48`). It is saved with the account and remembered by the browser for the login page.

`src/appearance/ThemeColorProvider.tsx` is the only place that decides the colour. When building pages:

- Use MUI's palette: `color="primary"`, `sx={{ color: "primary.main" }}`, and so on.
- In CSS, use `var(--mui-palette-primary-main)`, `rgb(var(--mui-palette-primary-mainChannel) / 0.1)` for tints, and `var(--mui-palette-primary-contrastText)` for text on the colour.
- Never write the primary colour as a hex value in a page or component.
- Colour amounts with `var(--hk-expense-color)` and `var(--hk-income-color)`, which follow the user's amount colour choices.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
```
