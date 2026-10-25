# Atlas: a physical map for Virgil (plan)

Status: **built** (October 2026) for all three books. The data format is in `docs/atlas-data-spec.md`.

The build differs from this plan in four ways:
- **No line through every setting.** The "story path" through all settings was dropped: in city frames it turned into spaghetti. What the book's movement actually is now comes from authored **journeys**, with "recent" legs drawn by default. The current chapter's places are drawn in gold, plus a "you are here" lantern pulse.
- **Map view is full-screen.** It sits between the header and the tab bar, with a "List" pill. It is not an inline map under the segment control.
- **Basemaps** are built by `scripts/atlas/build-basemaps.mjs` from Natural Earth and OpenStreetMap. Drawings are authored in `scripts/atlas/draw-plans.py`.
- **20,000 Leagues** isn't in the library yet. Its ocean frame and depth profile are still to do.

## 1. What readers need

In classics, readers get lost in *where* more often than they think:

- **Monte Cristo:** Marseilles, the Château d'If, Monte Cristo island, Rome, Paris, Auteuil, Normandy and Yanina. Most readers have no idea how far apart these are, or what side of Paris Auteuil is on.
- **Harry Potter:** Privet Drive → London → King's Cross → Hogwarts. Hogwarts itself has an inner geography: towers, dungeons, the forest, the lake, the third-floor corridor.
- **The Pearl:** a small world — the beach, the town, the gulf, the mountains — where the flight in chapter 6 is a journey with direction.
- **20,000 Leagues:** almost entirely a *route* through the oceans, with depth as a third dimension.

So the feature answers three questions, always only up to the bookmark:

1. **Where is this chapter set?**
2. **Where is that place relative to everything else?**
3. **How did we get here?** (the journey)

## 2. The core problem: four kinds of geography

| Kind | Example | How to show it |
| --- | --- | --- |
| Real, mappable | Marseilles, Rome, the Bois de Boulogne | Real coordinates on a real map |
| Real but vague or fictional-in-real | Privet Drive ("Little Whinging, Surrey"), Pont du Gard inn, Kino's town (≈ La Paz) | A soft area or halo on a real map, labelled "approximate", never a precise pin |
| Purely fictional | Hogwarts, the Forbidden Forest, Spada's grotto | Our own schematic "plan" drawing with its own coordinate space |
| A route, not a place | The Nautilus, Dantès' voyages, Kino's flight | A path drawn segment by segment, plus a depth profile when depth matters |

**One map engine cannot fake all four well.** The plan is one data model and one screen, with two kinds of map surface ("frames"):

- **Geo frames** use real longitude and latitude in a chosen projection and region. Examples: "The Mediterranean", "Paris, 1830s", "Marseilles & its bay", "The world's oceans".
- **Plan frames** use our own drawn coordinates. Examples: "Hogwarts & grounds", "Monte Cristo island", "Kino's town".

A place can sit in more than one frame. The Château d'If is a dot on "The Mediterranean" and a labelled island on "Marseilles & its bay". Frames link to each other: tapping the Paris cluster on the Mediterranean frame zooms into the Paris frame.

## 3. Technology recommendation

**Recommended: custom SVG maps, using d3-geo plus pre-built map data.** This extends what the relationship map already does (SVG, d3-zoom, our design tokens).

- **Base geography:** Natural Earth (public domain) for coastlines, countries, rivers, lakes and ocean depth bands. For each geo frame, a build script clips and simplifies it to a small TopoJSON file (typically 20–150 KB), loaded only when that frame opens.
- **City frames (Paris, Marseilles, Rome, London):** a hand-simplified set of rivers, old city walls and a few period-correct streets, with landmarks. We draw it, not tile it. Modern street tiles are actively wrong for 1830s Paris: there were no Haussmann boulevards, and the city walls ran where the Boulevard Périphérique is now.
- **Plan frames:** authored SVG drawings with an x/y coordinate space, styled in the same ink and paper look. Each is drawn from the text's own descriptions, not copied from any published Hogwarts map (licensing).
- **Size:** d3-geo plus topojson-client add roughly 40 KB gzipped. The rest is per-book data, lazy-loaded.

Why not the alternatives:

| Option | Verdict |
| --- | --- |
| **Leaflet or MapLibre with OpenStreetMap or vector tiles** (OpenFreeMap, Protomaps) | Real street detail, but the map shows modern places with modern names. It looks like a navigation app, not a book. It is hard to fit to our warm and dark themes, adds ~250 KB+ of library, works badly offline, and needs licence credits (ODbL). Its one strength, street-level precision, is a weakness for a historical novel. |
| **Static illustrated images per book** | Beautiful, but nothing can be tapped, revealed by chapter, or zoomed sharply, and every change means redrawing art. |
| **Google or Apple Maps embeds** | Need API keys, track users and look modern. No. |

Possible later add-on: a "See it today" link on each real place, opening Apple or Google Maps at the real spot. That gives modern context without bringing modern maps into the reading experience.

## 4. Data model

A new per-book file, `data-src/<book>/places.json`, merged and validated like everything else:

```jsonc
{
  "frames": [
    { "id": "med", "type": "geo", "title": "The Mediterranean", "bounds": [[-6, 30], [30, 47]], "base": "med.topo.json" },
    { "id": "paris", "type": "geo", "title": "Paris, 1830s", "bounds": [[2.22, 48.81], [2.42, 48.91]], "base": "paris-1830.topo.json", "parent": "med" },
    { "id": "hogwarts", "type": "plan", "title": "Hogwarts & grounds", "size": [1000, 800], "art": "hogwarts.svg" }
  ],
  "places": [
    {
      "id": "chateau-dif",
      "name": "Château d'If",
      "role": "setting",            // setting | mentioned
      "firstChapter": 8,
      "parent": "marseilles",       // for "inside" relationships and breadcrumbs
      "at": [
        { "frame": "med", "lonlat": [5.325, 43.28] },
        { "frame": "marseilles", "lonlat": [5.325, 43.28] }
      ],
      "precision": "exact",         // exact | approximate | fictional | unknown
      "today": "Château d'If, Frioul archipelago — open to visitors",
      "taglines": [ { "from": 8, "text": "…" } ]   // same versioned taglines as characters
    }
  ],
  "journeys": [
    {
      "id": "dantes-escape", "who": ["edmond-dantes"],
      "legs": [ { "chapter": 21, "from": "chateau-dif", "to": "tiboulen", "mode": "swim" },
                { "chapter": 22, "from": "tiboulen", "to": "leghorn", "mode": "sea" } ]
    }
  ]
}
```

Plus one field on each chapter, `settings: ["marseilles", "reserve-inn"]`: where the chapter takes place, primary first. That one field powers "where is this chapter set", the story path and the "now" marker.

**Joining with what exists:**
- The 16 existing `kind: "place"` cast entries keep their ids and become the "major" places. The Places tab and the relationship map keep using them.
- Glossary place notes (94 in Monte Cristo) get an optional `placeId`. Tapping "Yanina" in a note can then show it on the map.
- Characters can be "seen at" a place through the chapter `characters` + `settings` overlap. That comes free, with nothing new to author.

**Validation** added to `npm run validate`:
- Every place used in `settings` exists and was introduced by that chapter.
- Coordinates fall inside the frame bounds.
- Each journey leg's chapter is at or after both places' first chapters.
- Every plan frame has its art.

## 5. Spoiler rules (the part that has to be right)

- A **place appears** only from its `firstChapter`, and its tagline follows the bookmark, the same as characters.
- **Frames unlock** only once a place in them has been reached. Before chapter 31, the frame list must not show a "Rome" chip, or it gives away the trip.
- **Journeys** draw only the legs at or before the bookmark. The line ends at "you are here", not at the destination.
- **Hidden or secret places** use the `mergedInto` pattern. Spada's grotto is "a cave on Monte Cristo" until the reader knows what it is. The Count's "Normandy house" doesn't exist until chapter 82.
- **Base geography is neutral.** Seeing Greece on the Mediterranean map spoils nothing, but a *pin* on Yanina before chapter 77 would.
- **Auto-fit** zooms only to unlocked places, never to the whole extent of the book.
- The **chapter scrubber** (as on the relationship map) goes from 1 to the bookmark only.
- The places data gets the same independent spoiler review pass as notes and primers.

## 6. UX design (mobile first)

### 6.1 Where it lives

The Cast tab has **People | Places | Things**. Places is the natural home:

- **Places gets a List | Map toggle** in its toolbar, defaulting to List the first time. Map shows the Atlas inline, edge to edge, under the segment control. The choice is remembered per book.
- The relationship map button beside the "Cast" title is **renamed "Connections"**, with a nodes icon, so "Map" means one thing only. The relationship map keeps working exactly as it does now.
- No fifth bottom tab. Four tabs is the comfortable limit on a phone, and a map isn't a daily destination the way Today or Chapters is.

### 6.2 The Atlas screen (Apple Maps pattern)

- **Full-bleed map.** Pinch, drag and double-tap to zoom, with zoom buttons for one-handed and accessible use (as on the relationship map).
- **Frame chips** across the top: `Mediterranean · Marseilles · Paris · Rome`. Only unlocked frames show. The frame for the current chapter is picked automatically, and chips scroll sideways.
- **Pins**, in three visual grades:
  - *Setting* places: a filled burgundy pin with a label.
  - *Mentioned* places: a small ink dot whose label shows only when zoomed in. Toggled in Filters, on by default only in city frames.
  - *Approximate* places: a dashed soft circle labelled with "≈ approximate" in the sheet.
- **"You are here"**: a gold lantern marker (matching the app icon) on the bookmark chapter's setting. It is the anchor of the whole screen.
- **Story path**: a dotted ink line through the settings in chapter order, fading with age so the recent path reads clearly. Toggled in Filters.
- **Tap a pin** to open a bottom sheet at peek height. It shows the name, the tagline as of the bookmark, "Chapters 8–21, 113" as tappable chips, who you've met there (avatars), and buttons for "Open place" and, for real places, "See it today". Drag the sheet up for the full place profile.
- **Clusters**: many pins together (Paris on the Mediterranean frame) become a numbered badge. Tapping it zooms into the child frame.
- **Chapter dock** at the bottom: "Ch 40 ⟵ slider ⟶ Now", replaying the story's movement (the same component as the relationship map).

### 6.3 Map everywhere else (the integration)

| Where | What |
| --- | --- |
| **Chapter detail** | A "Where" card at the top of Summary: a small static map with the chapter's setting pin(s) and "Paris · the Count's house on the Champs-Élysées". Tapping it opens the Atlas focused there. Highest-value entry point. |
| **Today: "Where you left off"** | One line with a pin icon, "📍 Auteuil, near Paris", linking to the Atlas. |
| **Before you read primer** | The "Setting" line gets a small map pin button, only for places already unlocked. |
| **Place profile** (Cast → Places → a place) | A mini-map at the top; "Chapters set here"; "People met here"; the versioned description. Its relationship ties stay as they are. |
| **Relationship map** | Place nodes (■) get an "On the map" action in their detail sheet. |
| **Glossary place notes** | "Show on map" in the note sheet when the note has a `placeId`. |
| **Search** | Place results show a pin icon and open the Atlas. |
| **Character profile** | (Later) "Where they've been": the places that share chapters with them. |

### 6.4 Look and feel

- Paper and ink, not satellite. Land is `--surface`, water is a pale blue-grey tint of the theme, coastlines and rivers are thin ink lines, labels are set in the app's serif.
- A proper dark mode: navy water, charcoal land, cream labels. Every colour comes from tokens.
- Each frame shows a scale bar ("50 km" / "1 mile") and a small compass on geo frames. Plan frames say "Not to scale — drawn from the book's descriptions".
- Accessibility: every pin is a real button with a label ("Château d'If, setting, chapters 8 to 21"). A "List" toggle is always one tap away. Animations are skipped when the system "reduce motion" setting is on.

### 6.5 Per-book sketches

- **Monte Cristo:** frames for the Mediterranean (Marseilles, If, Monte Cristo, Elba, Leghorn, Corsica, Rome, Greece/Yanina), Marseilles & its bay, Paris 1830s (Champs-Élysées house, Rue du Helder, Faubourg Saint-Germain, Père-Lachaise; Auteuil just outside), Rome (Corso, Colosseum, catacombs) and possibly Normandy/Tréport. Journeys: Dantès's voyages, Albert & Franz's Carnival trip, the flight from Paris.
- **Harry Potter:** a geo frame for Southern England (Surrey ≈, London, a "north" arrow for Hogwarts with "location unknown" — the books never place it). A London plan frame: Charing Cross Road → Leaky Cauldron → Diagon Alley, Gringotts, King's Cross / Platform 9¾. A Hogwarts & grounds plan frame: castle, Gryffindor tower, the third-floor corridor, dungeons, the lake, Hagrid's hut, the Forbidden Forest, the Quidditch pitch. The castle interior could later be a third plan frame for the trapdoor sequence.
- **The Pearl:** a geo frame for the Baja California Sur gulf coast (≈ La Paz, the gulf, the mountains) and a plan frame of the town: brush houses, beach, the doctor's gate, the church, the pearl buyers' street. Journey: Kino's flight to the mountain pool. "The capital" is an off-map arrow, since the book never names it.
- **20,000 Leagues** (future): one world-oceans geo frame with depth bands and the Nautilus route, with a **depth profile strip** under the map (route distance × depth, scrubbed with the chapter dock). This book is where the journey model matters most.

## 7. Content authoring workload

For each book, mostly research and data rather than code:

- Settings for every chapter: Monte Cristo 117, HP 17, Pearl 6.
- Coordinates and precision for each place: Monte Cristo roughly 60–80 including the mentioned ones, HP roughly 20, Pearl roughly 10.
- Base map data for each frame, plus plan art for the fictional frames. Hogwarts, Kino's town and Monte Cristo island are the hand-drawn ones.
- A spoiler review pass on all of the above.

## 8. Phasing

1. **Foundation + Monte Cristo (geo frames).** Data model and validation, the map renderer, Atlas inside Places with List | Map, the chapter "Where" card, place profile mini-map, frame unlocking and the chapter dock. Monte Cristo is the best stress test: real places at three scales.
2. **Journeys and story path,** plus **The Pearl.** It is small and mixes real and approximate places, with one key journey.
3. **Plan frames,** plus **Harry Potter** (London and Hogwarts). This is the fictional geography case.
4. **Integrations:** Today line, primer pin, glossary "Show on map", search, and the character "where they've been".
5. **20,000 Leagues** (when the book is added): ocean depth bands and the depth profile.

The first step inside phase 1 should be a clickable prototype of the Atlas screen with real Monte Cristo data for chapters 1–40, to settle the feel before committing to the full data authoring.

## 9. Open decisions

1. **Home:** a List | Map toggle in Places, with the relationship map renamed "Connections" (recommended), or keep "Map" for relationships and put the Atlas somewhere else?
2. **Look:** a paper-and-ink style (recommended), or a cleaner, modern map style?
3. **Mentioned places:** show the glossary's "mentioned" places as small dots (recommended), or only the places where scenes happen?
4. **First book:** Monte Cristo first (recommended, most value and the hardest real-world case), or Harry Potter first (fictional, most visual)?
