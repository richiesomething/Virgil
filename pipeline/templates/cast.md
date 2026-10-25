# Stage: cast

**Output:** `data-src/<book>/characters-<n>.json` for your share of `roster.json` (the brief names which ids). See "characters-*.json" in `docs/data-format.md`.

**Inputs:** `roster.json`, `reveals.json`, all `chapters-*.json` (summaries and details are your ledger of who knew what, when), and (text mode) the source text for detail.

For each character (and each object or place in the roster):

- **Fields:** `id`, `kind` (omit for people), `name`, `firstChapter`, `importance` and `group` from the roster.
- **tagline:** one short "who is this?" line per stage of the story. The first entry's `from` is `firstChapter`. Add a new entry whenever the reader's understanding changes (3–8 for major characters, 1–3 for minor).
- **description:** profile paragraphs. Each entry is shown from its `from` onward and adds to the earlier ones, so each says what's new by then.
- **aliases:** other names, each from the chapter the reader learns it.
- **moments:** key events with their chapter, one line each.
- **mergedInto:** for disguises, per `reveals.json`, and for anyone or anything whose name is learned late (20,000 Leagues: "the commander" merges into Captain Nemo, "the monster" into the Nautilus, at chapter 10). The real entry's `firstChapter` is the reveal chapter. Its profile doesn't inherit the stand-in's descriptions, so write its first description as a fresh profile at the reveal chapter, not as a retelling of the earlier scenes.
- **group** labels show from the first chapter, so they mustn't name anything secret (not "Aboard the Nautilus" before the ship is named).

Every line must be safe at its own chapter.
