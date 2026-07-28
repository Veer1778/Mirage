# Mirage

An open source frontend builder. Draw a wireframe, get a component.

## Structure

```
/
├── index.html          landing page              → /
├── mirage/
│   └── index.html      the editor                → /mirage
├── css/
│   ├── landing.css
│   └── mirage.css
├── js/
│   ├── landing.js
│   └── mirage.js
└── vercel.json
```

No build step. No dependencies. Every page is plain HTML/CSS/JS, so
Vercel serves it as-is.

`cleanUrls` in `vercel.json` is what lets `/mirage` resolve to
`mirage/index.html` without the `.html` or trailing slash — this is
also why the editor lives in its own folder instead of being a
sibling file (`mirage.html`), which Vercel's static handler won't map
to a clean route the same way.

## Run locally

Any static server works, e.g.:

```
npx serve .
```

Then visit `http://localhost:3000` and `http://localhost:3000/mirage`.

## Deploy to Vercel

**Option A — CLI**
```
npm i -g vercel
vercel
```
Framework preset: **Other**. No build command, no output directory
override needed — Vercel serves the repo root as static files.

**Option B — Git**
Push this folder to a GitHub repo, then in the Vercel dashboard:
New Project → Import → select the repo → Deploy. Same "Other"
framework preset, zero config.

## Adding a new page

Same pattern as `/mirage`: make a folder named after the route
(`about/`), put `index.html` inside it, keep its CSS/JS in the shared
`css/` and `js/` folders with a matching name.
