# PhysDeck — AS Physics 9702 Card Game

A single-page flashcard game for Cambridge International **AS Physics (9702)**
revision: 206 definitions, formulas, laws and units across all eleven AS topics,
wrapped in a spaced-repetition system and four game modes.

No build step, no backend, no dependencies — open `index.html` in a browser and
it runs. All progress lives in `localStorage`.

```
git clone <this repo> && cd Physics-Key-Card-game-
open index.html          # or: python3 -m http.server 8000
```

## Game modes

| Mode | What it does |
| --- | --- |
| **Flip Deck** | Classic flashcard. Tap or press space to flip, then swipe right / left (or ← →) to grade yourself. This is what drives the review schedule. |
| **Formula Recall** | The answer is hidden — type it out. The checker normalises notation (`v^2` ≡ `v²`, `rho` ≡ `ρ`, `1/2` ≡ `½`) and accepts any single clause of a longer model answer, then you self-grade. |
| **Speed Sprint** | 60 seconds of mixed-topic multiple choice. Three correct in a row raises the combo multiplier, up to ×5; a mistake resets it. Personal bests are kept. |
| **Match Pairs** | Six-pair memory grid for one topic — match each term to its definition or formula. |

## What each card asks for

Every card front carries three things: a **topic chip**, a **type chip**
(formula / definition / law / unit), and an **instruction line** saying what to
produce. Where a term alone is ambiguous the instruction names the specifics —
*Give the equation of motion linking v, u, a and s* rather than a bare
"Equation of motion (no time)". The same line appears in Formula Recall and
Speed Sprint, so the task is never guesswork.

Where a picture explains the answer better than a sentence, the revealed side
carries a **sketch graph** — the shape of a filament lamp's I-V curve, the
shaded area under a force-time graph, the nodes and antinodes on a stationary
wave. 27 cards have one. Match Pairs leaves it off: every
answer is already face-up on the grid, so there is nothing to disambiguate.

## Spaced repetition

A five-box Leitner system. Each card sits in a box that sets its review interval:

| Box | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Next review | 1 day | 2 days | 4 days | 8 days | 16 days |

- A correct grade moves the card up one box, doubling the interval.
- A wrong grade drops it straight back to box 1, and it comes round again before
  the end of the current session.
- Flip Deck and Formula Recall move cards between boxes, because both ask you to
  grade yourself deliberately. Speed Sprint and Match Pairs record exposure and
  XP but leave the schedule alone — recognising an answer among four options is
  not the same as recalling it.
- Each session queue is built due-cards-first (most overdue first), then unseen
  cards, then everything else.

## Progress

- **XP** per correct answer, weighted by card difficulty and by mode
  (recall pays best, sprint least). Levels need progressively more XP.
- **Ranks** from *Kinematics Cadet* up to *Field Theorist*.
- **Per-topic mastery** as radial gauges — the average box level across every
  card in that topic, so 100% means the whole topic is in box 5.
- **Daily streak**, kept alive by answering at least one card a day.
- **Local leaderboard** of your top five Speed Sprint scores.

## Files

| File | Contents |
| --- | --- |
| `index.html` | Markup for the HUD and all six screens |
| `style.css` | Dark lab/HUD theme — topic-coded glow, glassmorphism, 3D card flip |
| `app.js` | Leitner scheduling, the four modes, XP/levels, persistence, particle FX |
| `data.js` | The card content and the topic list |
| `graphs.js` | The sketch graphs drawn on the revealed side of a card |

## Content

| # | Topic | Cards |
| --- | --- | --- |
| 1 | Physical Quantities & Units | 23 |
| 2 | Kinematics | 21 |
| 3 | Dynamics | 18 |
| 4 | Forces, Density & Pressure | 16 |
| 5 | Work, Energy & Power | 15 |
| 6 | Deformation of Solids | 15 |
| 7 | Waves | 21 |
| 8 | Superposition | 19 |
| 9 | Electricity | 22 |
| 10 | D.C. Circuits | 15 |
| 11 | Particle & Nuclear Physics | 21 |

### Adding cards

Append to the `CARDS` array in `data.js`:

```js
{
  id: "kin-22",                       // unique
  topic: "kin",                       // an id from the TOPICS array
  type: "formula",                    // formula | definition | theorem | unit
  term: "Equation of motion (no time)",
  asks: "Give the equation of motion linking v, u, a and s",   // optional
  answer: "v² = u² + 2as",
  detail: "Derived from v = u + at and s = (u+v)t/2 — used when t is unknown.",
  difficulty: 2                       // 1-3, weights XP
}
```

`graph` is optional too — a key into `GRAPHS` in `graphs.js`, which draws a
small sketch graph on the revealed side under the answer. 27 cards use one
across 22 drawings: the I-V characteristics, the motion graphs, the
"area under the graph" cards, the deformation graphs, stationary waves on a
string and in a closed pipe, and the terminal-p.d.-against-current line.

Each `GRAPHS` entry is `{ svg, caption }`. The SVG is hand-authored and
self-contained — no libraries, no external references. Axes, ticks and labels
use `currentColor` so they take the card's own ink; the curve or shaded area
uses `var(--accent)` so it picks up the topic colour. The caption is rendered
as an HTML `<figcaption>` rather than SVG text, so it wraps on a phone.

`asks` is the instruction shown on the card front. Leave it out and one is
derived from `type` — *Give the formula*, *Give the definition*, *State the law
or relationship*, *Give the unit or value*. Set it wherever the term alone
doesn't pin down the answer: which of the four equations of motion is wanted,
whether a unit card wants the unit defined or expressed in base units, or when
the answer is the name of a quantity rather than a law. 81 of the 206 cards
carry one.

`formula` and `unit` cards render in the monospace face so exponents and
subscripts stay legible; the other two render in the body face. Nothing else
needs changing — topics, counts, gauges and every mode read straight from the
array. Records for cards that no longer exist are dropped from saved progress
on load.

## Notes

- Keyboard: `space` flips, `←` / `→` grade, `1`-`4` answer in Sprint, `Esc`
  leaves a mode.
- Fully responsive; tested down to 390 px wide.
- `Reset all progress` on the home screen clears everything.
