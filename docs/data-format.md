# Virgil book data format

This is the one reference for a book's data. The validator (`scripts/validate-data.mjs`) enforces it, and the templates in `pipeline/templates/` produce it.

## The golden rule: nothing ahead of the bookmark

A reader's bookmark is the last chapter they **finished**. Everything shown must be known to a first-time reader by the end of that chapter. Almost every field below carries a chapter (`from`, `firstChapter`, `chapter`, `revealed`, `through`), and that chapter is when it first appears.

- **Never point ahead.** Avoid "later", "will", "eventually", "ironically", "remember this", "this matters", and hints at outcomes or twists.
- **Disguises and secrets stay hidden until revealed.** List them in `reveals.json` first. Every other file must respect it.
- **When in doubt, cut.**

## Folder layout

```
data-src/<book>/                  ← the source of truth (edit these)
  book.json                       manifest (required)
  pipeline.json                   which stages are done (written by /add-book)
  reveals.json                    secrets and when they're revealed (strongly recommended)
  roster.json                     everyone's id, first name and first chapter (working file, not shipped)
  chapters-<a>-<b>.json           chapters, split into ranges by whoever wrote them
  characters-<n>.json             cast: people, objects, places
  relationships.json              ties between people
  things-relationships.json       ties to objects and places
  notes-<a>-<b>.json              glossary notes
  primers-<a>-<b>.json            "Before you read"
  recaps.json                     "Story so far" checkpoints
  word-counts.json                words per chapter
  themes.json, notice-<a>-<b>.json, afterword.json    understanding
  timeline.json                   only for books told out of order
  places-<a>-<b>.json             atlas: places, settings, journeys
  atlas/frames.json               atlas: map frames, with basemap recipes
  atlas/art-<frame>.json          atlas: drawings for plan frames (scripts/atlas/draw-plans.py)
  source/                         the book's text, if it's public domain (not shipped)
  research-*.json                 working notes (not shipped)

src/books/<book>/                 ← generated: node scripts/merge-data.mjs <book>
  book.json, data.json, atlas/*.json
```

Files split into ranges (`chapters-001-030.json`, `places-031-060.json`…) are merged automatically, so several agents can write different ranges in parallel.

## book.json

```jsonc
{
  "id": "twenty-thousand-leagues",       // = folder name, kebab-case
  "title": "Twenty Thousand Leagues Under the Seas",
  "shortTitle": "20,000 Leagues",        // optional, for the header
  "author": "Jules Verne",
  "year": 1870,
  "chapterCount": 47,
  "blurb": "One or two sentences, spoiler-free.",
  "edition": "Which text the chapters follow, e.g. 'Project Gutenberg #2488 (F. P. Walter translation)'",
  "sourceUrl": "https://www.gutenberg.org/ebooks/2488",   // optional
  "volumes": [ { "number": 1, "title": "Part One", "firstChapter": 1 } ],  // [] if none
  "color": "#1d4e63",                    // cover colour (dark enough for white text)
  "order": 4,                            // position in the library
  "source": "text",                      // "text" (built from the book) | "knowledge" (no text available)
  "wordCountsApproximate": false         // true when word counts are estimates
}
```

## reveals.json

Each entry is a secret, disguise, hidden identity or late-learned name, with the chapter at whose end the reader knows it. Write it first. Every other stage reads it.

```jsonc
[
  {
    "id": "count-is-dantes",
    "chapter": 30,
    "secret": "The Count of Monte Cristo, Sinbad the Sailor, Lord Wilmore and the Abbé Busoni are all Edmond Dantès.",
    "terms": ["Haydée"]     // optional: words that would only appear if the secret leaked
  }
]
```

The validator scans everything shown before `chapter` (names, taglines, descriptions, notes, primers, recaps, insights, places, timeline) for `terms`. Choose terms that give the secret away by themselves, such as a hidden name. Avoid words that appear innocently.

## chapters-*.json

```jsonc
[
  {
    "number": 1,
    "title": "Marseilles—The Arrival",    // "" for books whose chapters only have numbers
    "volume": 1,                          // omit if the book has no volumes
    "summary": "One or two sentences.",
    "details": ["Paragraph.", "Paragraph."],   // 2–4 paragraphs, plot only
    "characters": ["edmond-dantes", "morrel"]  // ids of everyone who appears or matters in it
  }
]
```

## characters-*.json

People, plus objects and places that matter enough for the cast and the Connections map.

```jsonc
{
  "id": "edmond-dantes",
  "kind": "character",                 // character (default) | object | place
  "name": "Edmond Dantès",             // the name the reader first knows; safe at firstChapter
  "firstChapter": 1,
  "importance": "major",               // major | supporting | minor
  "group": "Marseille, 1815",          // a short grouping label ("Places" for places, "Objects" for objects)
  "aliases": [ { "name": "the Count of Monte Cristo", "from": 30, "note": "optional" } ],
  "tagline": [ { "from": 1, "text": "One line: who this is, as known by then." } ],   // first entry at firstChapter
  "description": [ { "from": 1, "text": "Profile paragraph." } ],                    // grows as the reader learns more
  "moments": [ { "chapter": 5, "text": "Arrested at his betrothal feast." } ],
  "mergedInto": { "id": "edmond-dantes", "from": 30 }   // for a disguise that turns out to be someone else
}
```

A disguise the reader doesn't see through yet gets its own character, which merges into the real one when it's revealed.

## relationships.json and things-relationships.json

```jsonc
{
  "a": "kino", "b": "juana",
  "states": [ { "from": 1, "type": "love", "label": "Devoted husband and wife", "kin": "spouse" } ]
}
```

- `type`: family | love | friend | enemy | work | tie. Use `tie` for anything involving an object or place.
- `kin` (optional): parent | child | sibling | spouse | grandparent | grandchild | relative. It means "a is b's …" and drives the family view.

## notes-*.json (glossary)

```jsonc
{ "term": "Frioul", "kind": "place", "chapter": 8, "text": "2–4 sentences.", "quote": "a few words from the text", "seeAlso": [13, 21] }
```

- `kind`: word | title | money | history | reference | foreign | custom | place | lore.
- `quote` is for public-domain texts only.
- Duplicate terms merge, and the earliest chapter wins.

## primers-*.json ("Before you read" chapter N, shown when the bookmark is N−1)

```jsonc
{
  "chapter": 4,
  "setting": "Where and when chapter 4 opens; no events from it",
  "keepInMind": "What to remember from chapters 1 to 3.",
  "returning": [ { "id": "caderousse", "reminder": "Who they are, as known by chapter 3." } ]
}
```

## recaps.json

`[{ "through": 12, "title": "…", "text": ["paragraph", …] }]`: a "story so far" for chapters 1 to `through`. Write one roughly every 10–15% of the book.

## word-counts.json

An array of word counts, where index 0 is chapter 1. Count them from the text, or estimate them (and set `wordCountsApproximate`).

## Understanding

**themes.json**: `[{ "id", "name", "from", "summary": [{ "from", "text" }] }]`. The big ideas. The name must be safe at `from`. Each summary stage describes the theme as the reader understands it by then, and the first stage's `from` must equal the theme's `from`.

**notice-*.json**: `[{ "chapter", "kind", "title", "text", "themes": [ids] }]`. Two to four "what to notice" notes per chapter.

| Kind | What it covers |
|---|---|
| theme | How the chapter develops a big idea |
| motif | A recurring image, symbol or object |
| craft | How the author does something; foreshadowing only when the reader can already feel it |
| context | History or culture that changes how the chapter reads |
| question | Open, with no answer given |

**afterword.json** is shown only after finishing, so it can discuss everything:

```jsonc
{ "ending": ["…"], "themes": [{ "theme": "id", "text": "how it resolves" }],
  "interpretations": [{ "title", "text" }], "context": [{ "title", "text" }],
  "adaptations": [{ "title", "year", "kind", "note" }], "readNext": [{ "title", "author", "why" }],
  "questions": ["…"] }
```

**timeline.json** is for books told out of order. It's `{ "events": [...] }`, where each event is:

```jsonc
{ "id", "date": "1815-02-28", "label": "28 February 1815", "approx": false,
  "title", "text": [{ "from", "text" }], "revealed": 5, "chapters": [5],
  "flashback": false, "places": [placeIds], "people": [characterIds] }
```

`revealed` gates the whole event. An event's date or its position in time must not hint at anything unrevealed. Nothing may be listed in `people` before the reader knows they took part.

## Atlas

**atlas/frames.json** lists the map surfaces.

```jsonc
{
  "id": "paris", "type": "geo", "title": "Paris, 1830s", "short": "Paris",
  "parent": "mediterranean",                 // child frames appear as boxes or badges in their parent
  "bounds": [[2.215, 48.815], [2.425, 48.905]],   // geo: [[west, south], [east, north]]
  "projection": "mercator",                  // mercator (default) | equirectangular (whole-world or polar maps)
  "place": "paris",                          // the place this frame is a close-up of
  "note": "Shown in Map options.",
  "labels": [{ "text": "Seine", "at": [2.27, 48.85], "kind": "water", "from": 1 }],
  "recipe": { … }                            // how to build the basemap; see below
}
```

- Plan frames (drawings) use `"type": "plan"` with `"size": [w, h]`, an `anchor` in their parent, and `landmarks` (named x/y positions) for placing places.
- A frame whose location is unknown uses `"offmap": { "frame", "dir", "label", "badge" }` instead of an anchor.
- Label kinds: sea | region | area | water | minor | floor | street.

**Basemap recipes** (`node scripts/atlas/build-basemaps.mjs <book>`):

```jsonc
{ "type": "natural" }                                         // Natural Earth: land, lakes, rivers, islands
{ "type": "city",                                             // OpenStreetMap plus Nominatim
  "coastline": true,                                          // land from OSM coastlines (seaside cities)
  "river": { "osm": "Seine", "width": 150, "trace": ["Pont Neuf", "…"], "traceSuffix": "Paris" },
  "parks": ["Bois de Boulogne", "Jardin des Tuileries"],      // Nominatim names
  "walls": { "osm": true, "trace": [["Porta del Popolo", "…"]], "traceSuffix": "Roma", "coords": [[lon, lat], …] } }
```

For rivers, OSM water polygons are used when available, then the OSM centreline, then a line traced through the named bridges. Walls work the same way: OSM `historic=citywalls` first, then traced gates, then hand-given coordinates (historical walls that no longer exist).

**places-*.json**: `{ "places": [...], "settings": { "<chapter>": [placeIds, main first] }, "journeys": [...] }`.

```jsonc
// place
{ "id", "name", "role": "setting|mentioned", "firstChapter", "precision": "exact|approximate|fictional|unknown",
  "lonlat": [lon, lat], "radiusKm": 0.4, "xy": { "<planFrame>": [x, y] }, "parent": "placeId",
  "today": "modern note (real places)", "tagline": [{ "from", "text" }], "aliases": [{ "name", "from" }],
  "mergedInto": { "id", "from" }, "note": "exact glossary term" }
// journey
{ "id", "name", "who": [characterIds], "legs": [{ "chapter", "from", "to", "mode": "sea|land|road|rail|air|swim|boat|river|foot", "via": [[lon, lat], …] }] }
```

- A place's id must equal its cast id when it's also a cast place.
- Every chapter needs a `settings` entry.
- Coordinates are real. Fictional houses on real streets are `approximate` with a small `radiusKm`.
- Sea legs need `via` points that keep the line off land.
- `role` covers the whole book. The app works out what the reader has seen.

**atlas/art-<frame>.json** holds the drawings: `{ "bg", "features": [{ "k", "poly" | "line" | "at"+"r", "curve", "w", "from" }], "labels": [...] }`. Author them in `scripts/atlas/draw-plans.py`. Add `"from"` to any feature that would give something away.
