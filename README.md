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
| **Speed Sprint** | A 2-minute drill with a compulsory 16-question quota. See below. |
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

## Speed Sprint

A **2-minute round with a compulsory 16-question quota** — 7.5 seconds a
question.

For reference, Cambridge 9702 **Paper 1 is 40 four-choice questions in 1 hour
15 minutes**, about 113 seconds each. This drill is deliberately far faster:
those questions carry a full stem and working, where these are pure recall, so
the point is answering under time pressure rather than reproducing exam
conditions.

The quota is compulsory. Answer fewer than 16 and the run is marked *Pace not
met* and is **not** recorded as a personal best, however high the score. A live
pace pill reads *Ahead by n* / *On pace* / *Behind by n* against the rate you
need, so you feel the pacing during the round instead of working it out after.

What makes it hard:

- **The four options are the four most similar answers in the topic.** Options
  are drawn from the same topic and the same card type, and within that pool
  they are ranked by how closely their wording matches the right answer. So
  `s = ut + ½at²` is answered against `s = (u+v)t/2` and `v = u + at`, and
  "Tensile strain" against the definitions of stress, Young modulus and the
  spring constant. The nearest six are shuffled before three are taken, so the
  same card doesn't always show the same decoys.
- **8 seconds a question.** A bar runs down beside the options; let it empty and
  the question is wrong and moves on.
- **A wrong answer or timeout costs 5 seconds** of round clock. Sitting out the
  round only gets you 9 questions of the 16, so passive play cannot pass.
- **Half the questions run backwards** — you are shown the answer and must name
  the quantity, law or unit.
- **The draw is weighted** hard towards difficulty-3 cards, low Leitner boxes,
  and cards you miss more often than you hit. No repeats for 10 questions.
- **Scoring rewards speed**, and the combo multiplier now needs four correct in
  a row per step rather than three.

To re-pitch it, change the constants at the top of `app.js`: `SPRINT_SECONDS`,
`SPRINT_QUOTA`, `SPRINT_QUESTION_LIMIT`, `SPRINT_WRONG_PENALTY`,
`SPRINT_REVERSE_CHANCE`, `SPRINT_NEAR_POOL` and `SPRINT_NO_REPEAT`.

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
- **Local leaderboard** of your top five Speed Sprint scores — runs that miss
  the 16-question quota are not eligible.

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
