# Virgil

A spoiler-free reading companion for difficult books. Set a bookmark at the last chapter you
finished, and Virgil shows chapter summaries, the cast of characters you've met, and character
profiles — all stopping at your bookmark.

**Live:** https://richiesomething.github.io/Virgil/

Books so far:

- *The Count of Monte Cristo* (Project Gutenberg #1184, 117 chapters). Summaries and profiles were written from the public-domain text.
- *Harry Potter and the Sorcerer’s Stone* (US edition, 17 chapters), added for testing. The book is under copyright, so no text from it is included; summaries and profiles are original, written from knowledge of the book.

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
- `characters.json` — see `Character` in `src/types.ts`. Every piece of information has a
  `from` chapter; `src/lib/spoilers.ts` is the only place that decides what the reader may see.

`data-src/<id>/` holds the per-chapter working files (summaries and character notes written from
the source text). `node scripts/merge-data.mjs <id>` rebuilds `chapters.json` and `characters.json`, and
`npm run validate` checks the data for broken references and spoiler leaks (e.g. a character
listed in a chapter before their first appearance).
