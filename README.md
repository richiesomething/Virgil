# Virgil

A spoiler-free reading companion for difficult books. Set a bookmark at the last chapter you
finished, and Virgil shows chapter summaries, the cast of characters you've met, and character
profiles — all stopping at your bookmark.

**Live:** https://richiesomething.github.io/Virgil/

Books so far:

- *The Count of Monte Cristo* (Project Gutenberg #1184, 117 chapters). Summaries and profiles were written from the public-domain text.
- *Harry Potter and the Sorcerer’s Stone* (US edition, 17 chapters), added for testing. The book is under copyright, so no text from it is included; summaries and profiles are original, written from knowledge of the book.
- *The Pearl* by John Steinbeck (6 chapters). Also under copyright; handled the same way as Harry Potter.

## Features (Phase 1)

- **Library** with per-book progress.
- **Bookmark** ("I've finished chapter N"), saved in the browser. Titles of chapters you haven't
  reached are hidden, since some give away the plot.
- **Chapter summaries**: a one-line gist plus a fuller summary for every chapter you've reached.
- **Character list** limited to characters you've met, with search, group filter, sorting and
  "New" badges.
- **Character profiles** that grow as you read: taglines, profile paragraphs, aliases and key
  moments each carry the chapter where they become known. Secret identities stay separate
  characters until the book reveals them, then fold into the real person (`mergedInto`).

## Reading guide (mobile-first)

- **Today**: what's up next (with a time estimate and a collapsible "Before you read" primer), today's
  reading against your plan, where you left off, and who's in the story now. Welcome-back recap after a
  break of four days or more.
- **Chapter notes & glossary**: per-chapter notes on period words, money, history, references and foreign
  phrases (Summary · Notes · People on each chapter), and a searchable, filterable glossary that grows as
  you read.
- **Story so far**: recap checkpoints plus the chapters since, and who matters right now.
- **Search** from anywhere: names, nicknames, disguises, places, glossary terms and chapter numbers —
  only what you've reached.
- **Reading plan**: reading speed, a minutes-a-day or finish-by goal, projected finish date, today's
  progress, streaks, pace and upcoming chapter times. Jumping ahead several chapters doesn't count
  toward pace or streak.
- **The bookmark** is a header chip that opens a sheet: "I finished Chapter N", back one, or choose a
  chapter (jumping ahead asks first); every change can be undone.

## Features (Phase 2)

- **Character map**: an interactive relationship graph (drag, zoom, tap a character for their
  relationships). Relationships change over the book and are gated like everything else; a replay
  slider shows the map at any earlier chapter. Profiles list relationships too.
- **Objects and places**: important things (the Pearl, the Invisibility Cloak, the Château d’If…)
  have spoiler-gated profiles like characters. On the map they're diamonds (objects) and rounded
  squares (places), hidden until switched on with the "Also show" toggles; the Characters page has
  People / Objects / Places tabs.
- **Family view**: a "Family only" toggle on the map shows just family ties and marriages, each
  family as its own block with parents above children. Lists show roles (Parent, Spouse…).

See [ROADMAP.md](ROADMAP.md) for what's next.

## Development

```sh
npm install
npm run dev        # local dev server
npm run build      # validates data, typechecks, builds to dist/
```

Pushing to `main` deploys `dist/` to the `gh-pages` branch via GitHub Actions.

## Data

Each book lives in `src/books/<id>/`:

- `meta.ts` — title, author, chapter count, volumes.
- `chapters.json` — `{ number, title, volume, summary, details[], characters[] }`.
- `relationships.json` — `{ a, b, states: [{ from, type, label }] }`; see `Relationship` in `src/types.ts`.
- `notes.json`, `primers.json`, `recaps.json`, `word-counts.json` — the reading guide (see `Note`,
  `Primer`, `Recap` in `src/types.ts`). Word counts for copyrighted books are estimates
  (`wordCountsApproximate`).
- `characters.json` — see `Character` in `src/types.ts`; `kind` is `character` (default), `object` or
  `place`. Links involving an object or place use the relationship type `tie`; in `data-src` they
  live in `things-relationships.json`. Family ties and marriages carry `kin` (parent, child, sibling,
  spouse, grandparent, grandchild, relative); `node scripts/set-kin.mjs <book> '<table>'` sets them. Every piece of information has a
  `from` chapter; `src/lib/spoilers.ts` is the only place that decides what the reader may see.

`data-src/<id>/` holds the per-chapter working files (summaries and character notes written from
the source text). `node scripts/merge-data.mjs <id>` rebuilds `chapters.json` and `characters.json`, and
`npm run validate` checks the data for broken references and spoiler leaks (e.g. a character
listed in a chapter before their first appearance).
