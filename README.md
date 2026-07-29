# Mirage

An open source frontend builder. Draw a wireframe, get a component.

Mirage reads the geometry of a sketch the way a person does — where a box
sits, how tall it is for its width, and what sits beside it — then builds
the page that geometry implies and hands you the code.

## Structure

```
/
├── index.html          landing page        → /
├── mirage/
│   └── index.html      the editor          → /mirage
├── css/
│   ├── landing.css
│   ├── mirage.css      editor chrome
│   └── themes.css      34 design styles
├── js/
│   ├── landing.js
│   └── mirage.js       the engine
└── vercel.json
```

No build step, no dependencies, no server. Every page is plain
HTML/CSS/JS served as static files.

## How the model works

The sketch is stored as integer grid cells, not pixels:

```js
{ cx: 0, cy: 2, cw: 7, ch: 6 }   // column, row, width, height
```

Cells are square, so a box's aspect ratio is literally `ch / cw`. That one
decision gives square grid rendering, vertical snapping, collision
detection and side-by-side layout the same arithmetic.

**Rows.** Boxes whose vertical spans overlap belong to the same row and are
rendered as a horizontal band with `grid-template-columns` derived from
their widths. This is why an image drawn beside a hero appears beside it
rather than under it.

**Collision.** Boxes can never overlap. A blocked move is retried on each
axis separately, so dragging slides along an obstacle instead of stopping.

**Overrides.** Any box you set by hand is never re-read by the classifier.
Low-confidence reads are flagged rather than guessed silently.

## Styles

34 total: 4 house themes plus the 30 catalogued at
[designprompts.dev](https://designprompts.dev). Each is a set of design
tokens on `#sheet`, so switching one never touches your structure.

## Run locally

```
npx serve .
```

Then open `http://localhost:3000` and `http://localhost:3000/mirage`.

## Deploy

```
vercel
```

Framework preset **Other**, no build command. `cleanUrls` in `vercel.json`
maps `mirage/index.html` to `/mirage`.

## Licence

MIT
