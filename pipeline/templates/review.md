# Stage: review (independent spoiler and accuracy check)

You are a reviewer, not the author. Assume leaks exist and find them.

**Inputs:** the files the brief assigns, `reveals.json`, `chapters-*.json` (the ledger), and (text mode) the source text.

For every entry, work out when it is first shown (its `from`, `chapter`, `firstChapter`, `revealed` or `through`; primers show at chapter−1). Then check:

1. **Spoilers.** Does it use anything not known by then? This includes hints, leading questions, names, dates, ordering, and judgements that only make sense in hindsight.
2. **Secrets.** Does it break anything in `reveals.json`?
3. **Accuracy.** Wrong chapter, wrong person, a misremembered detail. Text mode: check against the text.
4. **Voice.** Generic filler, recap where a summary already exists, or long quotes from a copyrighted book.

Fix problems in place with minimal edits. Run the merge and validate. Report every change (file, entry, problem, fix), and the borderline items you left alone and why.
