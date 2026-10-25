# Stage: understanding (themes, insights, afterword)

See "Understanding" in `docs/data-format.md`. There are three parts.

## A. Themes (one agent)

**Output:** `data-src/<book>/themes.json`.

- Write 5–8 themes, each with `id`, `name` (safe at `from`) and `from` (the first chapter a reader could sensibly notice it).
- Then write its `summary`: 3–8 stages, each describing the theme as understood by then, each safe at its `from`. The first stage's `from` must equal the theme's `from`.
- This agent may read the whole book.

## B. Insights (parallel by chapter range)

**Output:** `data-src/<book>/notice-<a>-<b>.json`.

- Write 2–4 notes per chapter (more for pivotal chapters), mixing the kinds theme, motif, craft, context and question.
- Tag each note with theme ids whose `from` ≤ the chapter.
- Text mode: read only up to the end of your range.
- Each note is like a good teacher's margin comment, specific to this chapter. A craft note about foreshadowing may only point out what the reader can already feel.

## C. Afterword (one agent, after A)

**Output:** `data-src/<book>/afterword.json`. It's shown only after finishing, so everything may be discussed.

- The ending explained, in 3–5 paragraphs.
- A resolution for every theme id.
- 3–5 interpretations and critical debates.
- 2–4 context items: author, history, sources.
- Adaptations with years. Only include ones you are sure of.
- 5–8 books to read next, each with a one-line reason.
- 6–8 discussion questions.
