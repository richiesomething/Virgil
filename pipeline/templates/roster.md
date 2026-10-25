# Stage: roster (reconcile the cast across chapter ranges)

**Inputs:** every `chapters-*.json`, plus the chapter agents' reports if you have them.
**Outputs:** `data-src/<book>/roster.json`, and corrected `characters` lists in the `chapters-*.json` files.

1. Find duplicate ids for the same person (`dantes` / `edmond-dantes`, `the-count` / `count-of-monte-cristo`). Choose one id per person, and fix every chapter file to use it.
   - **Exception:** a disguise or secret identity the reader doesn't see through yet keeps its own id, such as `abbe-busoni`. Note it for the reveals stage.
2. Write `roster.json` as an array of objects: `{ "id", "name", "kind": "character|object|place", "firstChapter", "importance": "major|supporting|minor", "group" }`.
   - `name` is the name the reader first knows.
   - `importance` follows how much the person matters across the whole book.
   - Include objects and places that matter enough to have a profile, such as the pearl or the Château d'If. `kind` is `object` or `place` for those.
3. Run the merge and validate (see `_common.md`).
