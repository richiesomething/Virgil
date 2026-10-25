# Stage: primers ("Before you read")

**Output:** `data-src/<book>/primers-<a>-<b>.json` for your range. See "primers-*.json" in `docs/data-format.md`.

The primer for chapter N is read *before* chapter N, when the bookmark is N−1. So it may only use chapters 1 to N−1, plus where and when chapter N opens.

- **setting:** where and when chapter N opens, in a few words. Name no events from it, and no new characters' secrets.
- **keepInMind:** one to three sentences on what to remember from earlier chapters that chapter N relies on.
- **returning:** characters who reappear in chapter N after an absence of a few chapters or more, each with a `reminder` as known by chapter N−1. Use a disguised character's own id.
- Chapter 1's primer orients the reader: the book's world and how to read it.

Text mode: you may read the opening of chapter N for the setting only.
