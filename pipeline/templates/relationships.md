# Stage: relationships

**Outputs:** `data-src/<book>/relationships.json` (person to person) and `things-relationships.json` (person to object or place, `type: "tie"`). See the relationships section of `docs/data-format.md`.

**Inputs:** the `characters-*.json` files, `chapters-*.json`, `reveals.json`.

- Cover every meaningful tie: family (with `kin`), love, friendship, enmity and work.
- Each tie has `states` that change as the story does. A state is shown from its `from`, and its `label` describes the tie as the reader understands it then.
- A tie the reader doesn't know about yet (secret parentage, a hidden alliance) starts at the reveal chapter.
- Only use ids that exist in the cast.
