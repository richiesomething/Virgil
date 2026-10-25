# Stage: chapters

**Output:** `data-src/<book>/chapters-<a>-<b>.json` for your range (zero-padded to the width of the chapter count, e.g. `chapters-01-12.json`). See "chapters-*.json" in `docs/data-format.md`.

For each chapter in your range, write:

- **number**, plus `volume` if the book has parts (see `book.json` volumes).
- **title**: the chapter's own title, or `""` if chapters are only numbered.
- **summary**: one or two sentences, plot only, covering what happens in this chapter.
- **details**: 2–4 paragraphs that tell the chapter clearly enough to refresh a reader's memory. Name people as the reader knows them *at that point*.
- **characters**: ids of everyone who appears, or who is meaningfully discussed. Make up ids from the name the reader first knows. Keep a list at the end of your report, as `id — name as first known — first chapter`, so ids can be reconciled across ranges.

Text mode: read the chapters in your range from `source/chapters/`. You may skim earlier chapters for names, but don't read past your range.
