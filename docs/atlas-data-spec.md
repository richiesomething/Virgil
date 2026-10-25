# Atlas data spec

The physical map (Atlas) reads, per book:

- `data-src/<book>/atlas/frames.json`: the map frames (hand-authored).
- `data-src/<book>/atlas/art-<frame>.json`: drawings for plan frames (hand-authored).
- `data-src/<book>/places-*.json`: places, chapter settings and journeys. One or more files; `merge-data` combines them.

`node scripts/merge-data.mjs <book>` writes `src/books/<book>/atlas.json`. `npm run validate` checks everything below.

## Frames

A frame is one map surface.

- **`geo` frames** use real longitude/latitude. `bounds` is `[[west, south], [east, north]]`.
- **`plan` frames** are our own drawings with an `x`/`y` space of `size: [w, h]` (y grows downward). Their `landmarks` describe where things are drawn, so places can be positioned consistently.

Other frame fields:

- `parent` links a frame to a broader one. A child geo frame shows in its parent as a labelled box; a child plan frame shows at its `anchor` (a coordinate in the parent's space).
- `offmap` places a frame's portal at the edge of another frame when its location is unknown (Hogwarts).

## places-*.json

```jsonc
{
  "places": [
    {
      "id": "chateau-dif",               // kebab-case; MUST equal the cast id when the place is already a cast place (kind "place" in characters)
      "name": "Château d'If",            // spoiler-safe at firstChapter
      "role": "setting",                 // "setting": a scene happens there | "mentioned": only talked about
      "firstChapter": 8,                 // first chapter that sets a scene there or names it, whichever is first
      "precision": "exact",              // exact | approximate | fictional | unknown
      "lonlat": [5.3253, 43.2799],       // real-world position (geo); omit for unknown or purely plan places
      "radiusKm": 0,                     // for "approximate": rough uncertainty radius in km
      "xy": { "castle": [640, 365] },    // positions in plan frames, by frame id, using that frame's landmarks
      "parent": "marseilles-city",       // optional: a larger place it belongs to
      "today": "Château d'If, on the Frioul islands; open to visitors.",  // optional modern note, real places only
      "tagline": [ { "from": 8, "text": "Island fortress off Marseilles, used as a state prison." } ],
      "aliases": [ { "name": "…", "from": 31 } ],          // optional, names learned later
      "mergedInto": { "id": "…", "from": 31 },             // optional, when a place turns out to be another
      "note": "Frioul"                                     // optional: exact `term` of the glossary note about this place
    }
  ],
  "settings": {
    "8": ["villefort-house-marseilles", "chateau-dif"]     // chapter number → place ids where its scenes happen, main one first
  },
  "journeys": [
    {
      "id": "dantes-escape",
      "name": "The escape from the Château d'If",          // spoiler-safe at its first leg
      "who": ["edmond-dantes"],                           // character ids (the app hides any not yet met)
      "legs": [
        { "chapter": 21, "from": "chateau-dif", "to": "tiboulen", "mode": "swim" },
        { "chapter": 22, "from": "tiboulen", "to": "leghorn", "mode": "sea", "via": [[6.5, 43.0], [9.0, 43.3]] }
      ]
    }
  ]
}
```

## Rules

- **Every chapter has a `settings` entry** with at least one place, unless the chapter has no scene of its own (rare).
- **Coordinates are real.** For geo places, give precise `lonlat` (5 decimals for city places, 3 or more for regional ones). Use what is known about the real location (for 19th-century Paris addresses, the actual street). Fictional houses on real streets get the street's position with `precision: "approximate"` and a `radiusKm` of about 0.2–0.5.
- **Fictional places on real maps** (Diagon Alley behind Charing Cross Road; Privet Drive in Little Whinging, Surrey) use `precision: "fictional"` or `"approximate"`, plus a `radiusKm` when the area is vague.
- **Places in plan frames** go in `xy`, positioned against the frame's `landmarks`. A place may have both `lonlat` and `xy` (Monte Cristo island: real lonlat; its grotto: `xy` only).
- **Unknown places** (the book never says where) get `precision: "unknown"` and no coordinates.
- **Sea legs** whose straight line would cross land need `via` waypoints that keep the line at sea. Land legs can be straight.
- **No spoilers.** Names, taglines and journey names are shown from their chapter. Taglines follow the cast convention: a short "what is this place" line, updated with `from` when the reader learns more. Never state anything the reader doesn't know by that chapter (identities, deaths, what's hidden there).
- **`role`**: `setting` for any place where a scene happens. `mentioned` for places only talked about that are still worth seeing on a map (where someone is going, where something happened offstage, places with glossary notes). Skip trivial mentions.
