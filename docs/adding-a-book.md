# Adding a book

**The quick way:** in a Claude Code session, run `/add-book <title>`. The skill in `.claude/skills/add-book/` walks every stage, runs agents in parallel, and keeps `data-src/<id>/pipeline.json` up to date. You can stop and resume in a later session.

**What it does, by hand:**

1. `npm run new-book -- <id> "<Title>" "<Author>" --year <y> [--gutenberg <n>]` scaffolds `data-src/<id>/`. With a Gutenberg number it also downloads the text (text mode); without one, the book is written from knowledge.
2. Text mode: `node scripts/pipeline/split-text.mjs <id> "<chapter heading regex>"` splits the text into chapters and counts words. Check the printed list against the edition.
3. For each stage in `scripts/pipeline/stages.mjs`, an agent follows `pipeline/templates/_common.md` plus that stage's template, and writes the files described in `docs/data-format.md`.
4. `npm run basemaps -- <id>` builds the maps; `python3 scripts/atlas/draw-plans.py` builds the drawings.
5. `npm run merge -- <id>`, then `npm run validate`, then `npm run build`.

**Not shipped:** `roster.json`, `reveals.json`, `pipeline.json`, `research-*.json` and `source/`. The app only sees `src/books/<id>/`.

## The book's text (reader)

Public-domain books ship their text so the reader can read them in Virgil's flash reader: `node scripts/pipeline/export-text.mjs <id>` after the split, then `text.status = "shipped"` in `book.json`. Books still in copyright get `"text": { "status": "upload" }`: the app offers **Add your copy** and parses the reader's own EPUB, PDF or text file on their device. See `docs/reading-spec.md`.
