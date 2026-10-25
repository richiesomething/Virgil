# Stage: atlas

Two parts, usually done by different agents. See "Atlas" in `docs/data-format.md`.

## A. Frames (one agent, first)

**Output:** `data-src/<book>/atlas/frames.json`.

Decide which map surfaces the book needs:

- A regional or whole-world `geo` frame. Use `"projection": "equirectangular"` for world or polar maps.
- City `geo` frames where scenes cluster.
- `plan` frames (drawings) for invented places.

Give each geo frame:

- `bounds` that cover where the book goes;
- a `recipe` (`natural`, or `city` with river, parks and walls);
- sea and region `labels` for orientation.

Plan frames need `size`, `anchor` and `landmarks`, which mark where things are drawn. Then write the drawing itself in `scripts/atlas/draw-plans.py` (add a function, and gate revealing features with `from`).

Skip plan frames if the book's geography is real.

## B. Places (parallel by chapter range)

**Output:** `data-src/<book>/places-<a>-<b>.json`: `places`, `settings` for every chapter in the range, and `journeys`.

- Reuse cast place ids, and ids other ranges will use. The brief lists the canonical ids.
- Coordinates must be real; you may geocode with Nominatim at most 1 request per second, with header `User-Agent: virgil-reading-app/1.0`. Fictional places on real streets are `approximate`. Unknown places have no coordinates.
- `firstChapter` is the first chapter a place is set or named. Taglines are versioned and spoiler-safe.
- Sea legs need `via` waypoints that keep them off land.

Afterwards the orchestrator runs `npm run basemaps -- <book>` and `python3 scripts/atlas/draw-plans.py`.
