# PNCL Cage Monitor – Phase 2 (Draft)

Frontend prototype for the PNCL feeding system **cage monitor**. Built with **React + TypeScript (Vite)** and **Tailwind CSS v4**.

> 48 cages organized into 8 feeding stations (6 cages per station) with group controls, compact layout for 1920×1080.

---

## Prerequisites

- **Node.js 18+ (tested on Node 22)**  
- **npm** (comes with Node). Yarn/pnpm also work if you prefer.

Check versions:
```bash
node -v
npm -v
```

---

## Get the code

### Option A — Clone from your repository (recommended)
```bash
# Replace with your actual repo URL
git clone https://github.com/<your-username>/pncl-cage-monitor.git
cd pncl-cage-monitor
```

### Option B — Starting from this folder (local checkout)
If you already have these files locally, just `cd` into the project:
```bash
cd pncl-cage-monitor
```

---

## Install dependencies

```bash
npm install
```

This installs React, Vite, TypeScript and Tailwind v4 (via `@tailwindcss/postcss`).

---

## Run the app (development)

```bash
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).  
Hot-reload is enabled; edits to `src/App.tsx` will refresh automatically.

---

## Build for production

```bash
npm run build
```

This produces an optimized build in `dist/`.

Preview the production build locally:
```bash
npm run preview
```

---

## Project Structure (important bits)

```
pncl-cage-monitor/
├── index.html
├── package.json
├── postcss.config.js           # Tailwind v4 plugin (@tailwindcss/postcss)
├── tailwind.config.js          # Tailwind content globs
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx                 # Main UI – stations, cages, group panel
    ├── main.tsx                # React root
    └── index.css               # Tailwind v4 entry: @import "tailwindcss"
```

**Tailwind v4 note:** styles are enabled via PostCSS plugin:
```js
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```
and a single import in `src/index.css`:
```css
@import "tailwindcss";
```

---

## Configuration

- **BrainBox links** (station headers): edit in `StationCard` component (`src/App.tsx`) and replace `href="#brainbox1"`/`"#brainbox2"` with your URLs. Add `target="_blank" rel="noopener noreferrer"` if you want them to open in new tabs.
- **Compactness**: global font-size is controlled on the root `<div>` (class `text-[11px]`). Decrease to `text-[10px]` for an ultra-compact fit.

---

## Common issues / fixes

- **Tailwind overlay about using `tailwindcss` directly**: ensure `postcss.config.js` uses `@tailwindcss/postcss` (Tailwind v4) as shown above.
- **npx errors with Tailwind init (Node 22)**: not needed here; config files are already included.

---

## Scripts

- `npm run dev` – start Vite dev server
- `npm run build` – production build to `dist/`
- `npm run preview` – preview the production build


