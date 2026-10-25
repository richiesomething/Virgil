# Understanding the book: data spec

Three reading-guide features, each gated by the reader's bookmark (the last chapter they finished).

All source files live in `data-src/<book>/`. Run `node scripts/merge-data.mjs <book>` to copy them into `src/books/<book>/`, and `npm run validate` to check them.

## 1. What to notice

### `themes.json`

The big ideas the book keeps returning to.

```jsonc
[
  {
    "id": "revenge-justice",
    "name": "Revenge and justice",         // must be spoiler-safe from `from`
    "from": 5,                              // first chapter where a reader could sensibly notice it
    "summary": [                            // "what we've seen so far", one line per stage, shown from `from`
      { "from": 5, "text": "Dantès is wronged by men who gain from his fall; the question of what he is owed is planted." },
      { "from": 24, "text": "…" }
    ]
  }
]
```

### `notice-*.json`

Two or three short notes per chapter about what is worth noticing in that chapter.

```jsonc
[
  {
    "chapter": 3,
    "kind": "motif",                        // theme | motif | craft | context | question
    "title": "Water as threat and refuge",  // short, spoiler-safe
    "text": "2–4 sentences, written as a thoughtful teacher would say it.",
    "themes": ["prison-freedom"]            // theme ids; may be empty
  }
]
```

What each kind means:

| Kind | What it covers |
| --- | --- |
| `theme` | How this chapter develops a big idea |
| `motif` | A recurring image, symbol or object |
| `craft` | How the author does something: structure, irony, point of view, foreshadowing the reader can see *now*, pacing, narrative voice |
| `context` | History or culture that changes how the chapter reads |
| `question` | An open question worth thinking about, with no answer given |

**The spoiler rule.** A note for chapter N may use only what a first-time reader knows by the end of chapter N. Never write "this will matter later", "remember this", "ironically, later…" or anything else that points ahead. Craft notes about foreshadowing may only point out a setup the reader can already feel, such as a pointed detail or an ominous tone. They never say what it sets up.

## 2. After you finish: `afterword.json`

This is shown only once the book is finished, so it can discuss everything.

```jsonc
{
  "ending": ["paragraph", "…"],                       // the ending explained: what happens and why it lands
  "themes": [ { "theme": "revenge-justice", "text": "how this theme resolves" } ],
  "interpretations": [ { "title": "…", "text": "…" } ], // major readings and critical debates, 3–5
  "context": [ { "title": "…", "text": "…" } ],         // author and history that recast the book, 2–4
  "adaptations": [ { "title": "…", "year": 2002, "kind": "film", "note": "one line" } ],
  "readNext": [ { "title": "…", "author": "…", "why": "one line" } ],
  "questions": ["discussion question", "…"]          // 5–8, for reflection or a book club
}
```

## 4. Timeline: `timeline.json` (books whose order of telling differs from the order of events)

```jsonc
{
  "events": [
    {
      "id": "dantes-arrested",
      "date": "1815-02-28",            // ISO; partial allowed: "1815-02" or "1815"
      "label": "28 February 1815",     // how to display the date; prefix "c." when approximate
      "approx": false,
      "title": "Dantès is arrested at his betrothal feast",   // spoiler-safe at `revealed`
      "text": [ { "from": 5, "text": "…" } ],                 // grows as the reader learns more
      "revealed": 5,                   // first chapter at the end of which the reader knows this happened
      "chapters": [5],                 // where it is narrated or told
      "flashback": false,              // true when it is told well after it happened (a backstory)
      "places": ["la-reserve"],        // Atlas place ids (optional)
      "people": ["edmond-dantes"]      // character ids (optional)
    }
  ]
}
```

`revealed` gates the whole event. A backstory told in chapter 44 about events of 1817 has `revealed: 44` and `flashback: true`. Dates given only later in the book need a separate event, or a later `text` entry; never show a date or fact before it is revealed.
