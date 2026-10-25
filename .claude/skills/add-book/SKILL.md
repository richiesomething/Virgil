---
name: add-book
description: Add a new book to Virgil end to end — scaffold, chapters, cast, secrets, glossary, primers, recaps, atlas, themes and insights, spoiler review, publish — using the pipeline templates and parallel agents. Use when the user asks to add a book, e.g. "/add-book The Great Gatsby" or "add 20,000 Leagues Under the Sea".
---

# Add a book to Virgil

Use `pipeline/templates/` (one brief per stage) and `docs/data-format.md`. Every agent you start reads `pipeline/templates/_common.md` plus its stage template. Your job is to orchestrate: split the work, start agents in parallel, merge, check, and keep `pipeline.json` current.

## 0. Before starting

1. **Resume if possible.** If `data-src/<id>/pipeline.json` exists, read it and continue from the first stage that isn't `done`.
2. **Identify the book.** Pin down title, author, year, and whether it's public domain with a Project Gutenberg text (prefer a good modern translation). Choose a kebab-case id.
3. **Scaffold it:** `npm run new-book -- <id> "<Title>" "<Author>" --year <y> [--gutenberg <n>]`. Leave out `--gutenberg` for copyrighted books (knowledge mode).

## 1. Manifest and chapter list (ask the user to confirm)

**Text mode:**
- Look at the start of `data-src/<id>/source/book.txt`, and find the heading pattern and where the book's text starts.
- Run `node scripts/pipeline/split-text.mjs <id> "<heading regex>" [--skip-before "<regex>"]`. It writes `source/chapters/NNN.txt` and `word-counts.json`, and prints every chapter heading.
- Adjust until the list is exactly the book's chapters, with no contents page, preface or notes.

**Knowledge mode:** write out the chapter list (numbers and titles) of the most common edition you're confident about.

**Then, in both modes:**
- Fill `book.json`: `chapterCount`, `volumes`, `edition`, a spoiler-free `blurb`, a dark cover `color`, `year`.
- **Confirm the chapter list.** Every spoiler gate depends on chapter numbers matching the reader's edition.
  - **Knowledge mode:** always show the user the list and the edition, and ask them to confirm.
  - **Text mode:** the list comes from the text itself, so show it and carry on, unless something looks off: a missing or duplicate chapter, or a preface counted as a chapter.
- Mark `manifest` done.

## What can run at the same time

Stages depend only on what they read, so overlap them:

- **Chapters first.** Everything depends on the chapter files.
- **Right after the chapters**, alongside the roster and reveals: glossary, recaps, atlas frames, themes. These only need chapter files.
- **After the roster:** cast, then relationships. Primers need the roster ids too, for `returning`.
- **After the cast and themes:** places (the cast's place ids), insights (theme ids), afterword.
- **Review comes last**, once everything it checks exists.

Hand each chapter agent the ids of the main characters if you can work them out (from the title or a quick look at the text), so ranges agree from the start.

## 2. Chapters (parallel)

- Split the book into ranges of about 10–15 chapters (text mode; a chapter-file total under about 60k words per agent) or about 20–30 (knowledge mode).
- Start one agent per range, all in one message: "Read pipeline/templates/_common.md and pipeline/templates/chapters.md and follow them. Book: <id>. Range: chapters a–b. Output: data-src/<id>/chapters-<a>-<b>.json."
- Then start one agent with `roster.md`.

## 3. Reveals, then cast and relationships

1. **Reveals:** one agent with `reveals.md`. Review its list yourself; it's what keeps everything else safe.
2. **Cast:** split `roster.json` across 2–5 agents, about 15–25 characters each, giving the majors to separate agents. Each writes `characters-<n>.json`.
3. **Relationships:** one agent with `relationships.md`, once the cast is done.
4. Merge and validate.

## 4. Reading guide (parallel)

- **Glossary:** `glossary.md`, by range.
- **Primers:** `primers.md`, by range.
- **Recaps:** one agent, `recaps.md`.

Start these together, then merge and validate.

## 5. Atlas

1. **Frames:** one agent writes `atlas/frames.json`, using `atlas.md` part A.
2. **Drawings:** if there are plan frames, it (or you) adds them to `scripts/atlas/draw-plans.py`, then run `python3 scripts/atlas/draw-plans.py`.
3. **Places:** agents by range, using part B. Give them a canonical list of ids for recurring places, including the cast's place ids.
4. **Basemaps:** `npm run basemaps -- <id>`, then `node scripts/atlas/check-legs.mjs <id>` and fix sea legs that cross land by accident. Building basemaps needs network access; OpenStreetMap servers can be slow, so retry on failure, or switch the recipe to Nominatim traces.

A book with no meaningful geography can skip the atlas: mark it `skipped`.

## 6. Understanding

1. **Themes:** one agent, `understanding.md` part A. It writes the theme ids.
2. **Insights:** agents by range, part B. Start them as soon as `themes.json` has its ids.
3. **Afterword:** one agent, part C, once the theme ids exist.
4. **Timeline:** only if the story is told markedly out of order. One agent, `timeline.md`. Otherwise mark it `skipped`.

## 7. Review (independent)

- Start reviewers with `review.md`, splitting by file group so no two edit the same file:
  - chapters and cast
  - glossary, primers and recaps
  - places
  - insights and themes
  - timeline
- Give reviewers the code-level facts they need, such as "primers show at chapter−1".
- Fix anything they flag but leave unresolved.
- Run the validator until there are no ✗ lines. It also checks `reveals.json` terms against everything shown before each reveal.

## 8. Publish

1. Run `node scripts/merge-data.mjs <id>`, then `npm run build`.
2. With `npx vite preview --port 4182` running, run `node scripts/check-pages.cjs <id>`: it opens every page of the book at three bookmarks and must report `bad 0`.
3. Preview and check the new book's pages on a phone-sized viewport: Today, Chapters, a chapter's tabs, Cast, Places List and Map, Themes, Afterword (at the last chapter) and Timeline. Use Playwright screenshots against `npx vite preview`.
4. Commit on a branch with the attribution lines. When the user approves, merge to main and push main and phase-1 (that deploys).
5. Mark everything done in `pipeline.json`.

## Keeping track

After each stage, update `data-src/<id>/pipeline.json`: `{ "status": "done" | "skipped", "notes": "…" }`. Report progress to the user briefly at each stage boundary: what's done, any judgement calls they should know about, and what's next.

## Quality bar

- Every chapter has a summary, details, a setting, and 2 or more insights.
- Major characters have versioned taglines.
- Secrets are in `reveals.json`.
- The validator is clean.
- Reviewers found no unresolved leaks.
