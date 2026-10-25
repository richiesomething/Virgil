# Working on a Virgil book (read this first, every stage)

Virgil is a spoiler-free reading companion for books, mostly classics. A reader sets a **bookmark**: the last chapter they finished. The app shows only what a first-time reader knows by the end of that chapter. Everything you write carries a chapter number that decides when it appears. The format of every file is in `docs/data-format.md`. Read the sections for your stage.

## Your inputs

- `data-src/<book>/book.json`: title, author, chapter count, and `source` (`text` or `knowledge`).
- `data-src/<book>/reveals.json`: the book's secrets and the chapter each is revealed. Never let one slip early.
- Whatever earlier stages produced (chapters, cast, places, …), as your stage's brief says.
- **If `source` is `text`:** the book is in `data-src/<book>/source/chapters/NNN.txt`. Base everything on the text, not on memory. **Read only up to the last chapter of your range.** Don't open later chapters unless your brief says you may (the afterword and theme resolutions may). What you haven't read, you can't leak.
- **If `source` is `knowledge`:** there is no text. Work from what you reliably know about the book and its chapter structure, as listed in `book.json` and the chapter files. If you're unsure of a fact, leave it out rather than guess, and list it in your report. Never quote more than a few words of a copyrighted book.

## The spoiler rule

Anything shown at chapter N may use only what a first-time reader knows by the end of chapter N.

- **Don't point ahead.** Avoid "later", "will", "eventually", "ironically", "remember this", "keep an eye on", "this matters", foreshadowing that names its payoff, and hindsight judgements.
- **Respect secrets and disguises.** Follow `reveals.json`. A disguised character has its own id until the reveal.
- **Ask questions without steering.** Questions to the reader must not lead toward a twist.
- **When in doubt, cut it.**

## Voice

- Write for an intelligent adult reading the book for the first time who wants to understand it.
- Be warm, concrete, plain and specific to this book; no filler.
- Use short sentences, and no plot recap where a summary already exists.
- Match the spelling convention already in the book's files.

## Ids

Ids are kebab-case and stable: `edmond-dantes`, `chateau-dif`. A character's id comes from the name the reader first knows them by. Reuse ids that already exist; check `data-src/<book>/roster.json` and the `characters-*.json` files.

## Finishing

- Write only the files your brief names, as JSON with 2-space indentation.
- Check they parse: `node -e "JSON.parse(require('fs').readFileSync('FILE','utf8'))"`.
- If your brief says to, run `node scripts/merge-data.mjs <book> && node scripts/validate-data.mjs` and fix every ✗ line for your book.
- Don't edit other files, and don't commit.
- Reply with a short report: what you wrote (counts), anything you were unsure of, and anything the next stage should know.
