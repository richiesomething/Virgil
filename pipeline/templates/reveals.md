# Stage: reveals

**Output:** `data-src/<book>/reveals.json`. See "reveals.json" in `docs/data-format.md`.

**Inputs:** all chapter files, `roster.json`, and (text mode) the full text, which you may read.

List every secret the book holds back, and the chapter at whose end a first-time reader knows it:

- hidden or disguised identities
- who did it
- someone presumed dead who is alive
- true parentage
- what is hidden where
- a name withheld until later

For each one, write `secret` in one plain sentence, and add `terms` only when a word would give it away by itself (a hidden name, such as "Haydée" or "Norbert").

**Disguises:** for each disguise, the disguised identity should have its own roster id until the reveal, then merge (`mergedInto`). Check `roster.json` does this, fix it if not, and say so in your report.

Also list "soft" secrets: twists the reader suspects but can't confirm. Reviewers need them too. Leave `terms` off unless a word truly leaks them.
