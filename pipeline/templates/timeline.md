# Stage: timeline (only for books told out of order)

**Output:** `data-src/<book>/timeline.json`. See "timeline" in `docs/data-format.md`. This agent may read the whole book.

- Include the main-line events, dated wherever the book gives dates.
- Make every backstory or flashback its own event, with `flashback: true` and `revealed` set to the chapter where the reader learns it.
- If the reader learns more about an event later, add a later `text` entry instead of revealing it early.
- **Watch for leaks through dates.** An event's date, and where it sits among other events, must not hint at a connection the reader hasn't made.
- `people` must not list anyone whose part in the event is still secret at `revealed`.
- `places` and `people` use existing ids.
