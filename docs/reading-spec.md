# Reading in Virgil: RSVP reader, book texts and "your copy"

Status: implemented on `book-pipeline`, 2026-10. This is the design; `docs/data-format.md` has the data fields.

## 1. Goal

Let the reader read the book itself inside Virgil, one word at a time (RSVP: rapid serial visual presentation), with the reader's progress tied to the bookmark that gates everything else.

- Public-domain books ship their text with the app. No upload needed.
- Copyrighted books get an **Add your copy** button: the reader imports their own EPUB, PDF or plain-text file. It is parsed on the device and never leaves it.
- Finishing a chapter in the reader moves the bookmark, with the same toast and Undo as the "I finished" button.

Non-goals for now: audio, annotations/highlights, syncing between devices (comes with the database), DRM'd files (Kindle, Apple Books), OCR of scanned PDFs.

## 2. Which text to use

Rule: the **easiest-to-read edition that is legally shippable**, and our chapter data must follow that same edition (chapter count and boundaries).

| Book | Text | Why |
|---|---|---|
| The Count of Monte Cristo | Standard Ebooks edition of the anonymous 1846 English translation (Chapman & Hall), 117 chapters, CC0 | The only complete English translation in the public domain, in Standard Ebooks' cleaned-up form: modernised spelling and punctuation, typos fixed, footnotes removed. The modern translations (Robin Buss, Penguin 1996) are copyrighted, so a reader who owns one can add it as their copy. Our chapter data follows the same 117 chapters. Fetched as the single-page XHTML and split with `scripts/pipeline/split-xhtml.mjs`. |
| 20,000 Leagues Under the Seas | Project Gutenberg #2488: F. P. Walter's 1991 translation, released to the public domain | Contemporary English. Already the edition our data follows. |
| The Pearl (1947) | Still in copyright in the US | Add your copy |
| Harry Potter and the Sorcerer's Stone | In copyright | Add your copy |

When adding a book, prefer in this order: a modern public-domain translation (Walter's Verne, Standard Ebooks where they modernise) → the Gutenberg text → user upload.

## 3. Data and files

### 3.1 `book.json` gains `text`

```jsonc
"text": {
  "status": "shipped",                 // "shipped" | "upload"
  "edition": "Project Gutenberg #1184, anonymous 1846 translation",
  "license": "Public domain",
  "sourceUrl": "https://www.gutenberg.org/ebooks/1184"
}
```

- `shipped`: chapter text files exist at `public/texts/<id>/NNN.txt` and `public/texts/<id>/manifest.json`.
- `upload`: the app shows **Add your copy**. (Books with no `text` field behave as `upload`.)

### 3.2 Shipped text files

`public/texts/<id>/NNN.txt` (NNN = chapter number, zero-padded): plain UTF-8, one paragraph per line, blank line between paragraphs, no chapter heading, no footnotes. Each is fetched on demand (one chapter at a time, a few KB to ~60 KB gzipped). `manifest.json`: `{ "chapters": 117, "wordCounts": [...], "edition": "...", "license": "...", "sourceUrl": "..." }`. The validator checks that `chapters` equals `chapterCount` and that every file exists.

Why files, not JSON in the bundle: Monte Cristo is 2.6 MB of text; it must not load with the app. GitHub Pages serves the files with HTTP caching, and the per-chapter split means the reader only downloads what they read.

### 3.3 The export script

`node scripts/pipeline/export-text.mjs <id>` reads `data-src/<id>/source/chapters/NNN.txt` (the split used for the summaries, not committed) and writes the public files:

1. Drops the heading block: leading short lines without sentence punctuation ("CHAPTER 1", "A Runaway Reef", "Chapter 1. Marseilles—The Arrival").
2. Drops volume markers (`VOLUME TWO`) and Gutenberg footnote blocks (`[12] …` paragraphs), and inline footnote markers `[12]`.
3. Joins hard-wrapped lines into paragraphs; keeps blank-line paragraph breaks.
4. Turns `_italics_` into plain words, normalises `--` to an em dash, collapses spaces.
5. Recounts words and rewrites `word-counts.json` (so estimates use the real text) unless `--keep-counts`.

The pipeline gets an optional `text` stage after `manifest`: for a `source: "text"` book, run export-text and set `text.status = "shipped"`.

## 4. The reader

### 4.1 Route and chrome

`#/b/<id>/read/<n>`: full-screen, no book header or tab bar (the reader needs the whole viewport and no distractions). A top strip has Close, the chapter label, and the view toggle; a bottom strip has the controls. Safe-area insets respected; `100dvh` layout; no page scroll in Flash view.

Access rule (spoiler model): the reader opens chapters `1 … upTo + 1`. Chapters further ahead show the same lock page as the chapter summary ("Chapter n is still ahead of you"). Reading ahead is done by finishing chapters in order, which is one tap at each chapter's end.

### 4.2 Two views

**Flash** (RSVP, the default)

- One word at a time in a reading face chosen for flashing (large x-height, open shapes, distinct letters): Literata by default, or Inter or Atkinson Hyperlegible from the reader's Aa sheet; the same face is used in the Text view. The optimal-recognition-point letter is in the accent colour and held at a fixed horizontal position so the eyes never move. Thin guide marks above and below the pivot. Pivot index by length: 1 letter → 0; 2–5 → 1; 6–9 → 2; 10–13 → 3; 14+ → 4 (Spritz's table).
- Tap the word area to play or pause. While paused the current sentence shows underneath with the current word highlighted (context), and the Text view is one tap away.
- Controls: back one sentence, play/pause, forward one sentence, speed (−/+ in steps of 25, 100–900 wpm, shown as "300 wpm"), progress bar across the chapter (tap or drag to seek by word).
- Progress panel above the controls, visible in both views and refreshed every ten words while playing: "Chapter 3 · 31%" and the chapter's time left (from the reader's own word timing at the current speed) over the scrubber; under it a hairline gold bar for the whole book with "1% of the book · ≈ 28 hr left" (this chapter's remainder plus the remaining chapters' word counts at the flash speed, with the 1.15 punctuation factor). The end card repeats the book line with "3 of 117 chapters".
- Keyboard: Space play/pause, ← → sentence, ↑ ↓ speed, Esc close.
- Timing: base = 60000 / wpm ms per word, then multipliers. Word longer than 8 letters ×1.2 (and +0.1 for each 3 letters beyond, capped ×1.8); numbers ×1.3; ends with `,` `;` `:` `—` ×1.5; ends with `.` `!` `?` ×2 (also closing quotes/brackets after them); paragraph end ×2.5. Ramp: the first 6 words after play start at half speed and ease to full. Words longer than 13 letters are split at a hyphen if present, otherwise into two chunks shown with a trailing/leading hyphen.
- The scheduler uses `setTimeout` chained from `performance.now()` with drift correction; it pauses on `visibilitychange` (hidden), on blur of the window, and when the route changes. A screen wake lock (`navigator.wakeLock`) is requested while playing and released on pause.

**Text**

- The chapter as scrollable paragraphs in the app's prose style, with the current word highlighted; tapping a paragraph moves the reading position to its first word and switches back to Flash (paused). Useful for re-reading a passage, checking a name, or reading normally.

### 4.3 Position and progress

- `virgil:reading:v1` (localStorage, same store helper as prefs): `{ [bookId]: { chapter, word, words, updatedAt } }`, written on pause, every 2 seconds while playing, on seek, and on leaving the page.
- Opening the reader for chapter `n` resumes at the stored word if the stored chapter is `n`; otherwise starts at word 0.
- **Chapter end** shows an end card: "Chapter n finished" with the primary button **Mark finished · continue to chapter n+1** (calls the context's `setBookmark(n)`, which shows the toast with Undo and logs the chapter in the reading plan, then opens chapter n+1 at word 0) and a secondary **Back to Virgil** (chapter summary page, which is now unlocked). If the chapter is already finished (re-reading, `n ≤ upTo`), the primary is just **Next chapter**. The last chapter's primary is **Back to Virgil** (the Today tab shows the Finished state).
- Today's Up-next card shows **Read chapter n** (or **Continue reading · 42%** when a position exists for that chapter). Chapter pages for finished chapters get a small **Read it again** link. With no text available, upload books show **Add your copy** instead.
- Reading speed for the planner (`prefs.wpm`, estimates) stays separate from the flash speed (`prefs.rsvpWpm`, default 300); the Settings sheet shows both.

### 4.4 Prefetch and caching

Chapter text is cached in memory per session. At 80% of a chapter the next one is fetched. Shipped texts rely on the browser HTTP cache (Pages sets long cache headers for hashed assets, short for `public/` files; the files are small so this is fine).

## 5. Add your copy (upload)

### 5.1 Entry points

- Today → Up next card → **Add your copy** (upload books with no imported text).
- Settings (gear on the library screen) → "Your copies of books": one row per copyrighted book, showing the file name when a copy is on this device; it opens the import page, which has **Remove**.
- Route `#/b/<id>/text`: the import page.

### 5.2 Formats

| Format | Parser | Notes |
|---|---|---|
| EPUB | `fflate` (unzip) + the browser's `DOMParser` | Best source. Reads `META-INF/container.xml` → OPF → spine order; each XHTML file's block elements become paragraphs; headings become heading candidates. |
| PDF | `pdfjs-dist` (lazy chunk, worker from the bundle) | Text items grouped into lines by y position, lines into paragraphs by vertical gap and indentation; repeated header/footer lines (page numbers, running titles) removed; end-of-line hyphenation joined. Scanned PDFs (no text layer) are rejected with a clear message. |
| TXT | built in | Paragraphs split on blank lines; hard-wrapped lines joined. |

Both parsers are loaded only when the import page is used, so the app bundle doesn't grow.

### 5.3 Chapter detection

The imported text must line up with Virgil's chapter numbering. Detection works on the list of paragraphs:

1. **Known titles.** Virgil knows every chapter title. A paragraph that equals a title (case- and punctuation-insensitive, with any "Chapter 3" prefix stripped) is a chapter start. If all `chapterCount` titles are found in order, done.
2. **Numbered headings.** Otherwise, paragraphs matching `^(chapter|part|book)?\s*(\d+|[ivxlc]+|one|two|…|twenty)\b` (short, no sentence punctuation) in increasing order.
3. **Review screen.** The result is shown as a list: chapter number, first words, word count. For chapters beyond the bookmark only the number and word count are shown (the first words of a later chapter can spoil). If the count doesn't match `chapterCount`, the screen says so and offers the candidate headings as checkboxes (the heading-like paragraphs), with a running count, so the reader can fix the split by hand. Saving requires exactly `chapterCount` chapters.
4. Front matter before the first chapter is dropped, and so is back matter after the last one that starts with a heading such as "About the author", "Acknowledgements" or "Appendix".
5. A table of contents matches every title too, with nothing between the entries; a match whose chapters have no text between their headings is rejected and the search starts again after it.

Known limits (checked against 31 generated layouts): two-column PDFs come out interleaved; a word hyphenated across lines with a plain ASCII hyphen is joined without it ("mail-carrying" → "mailcarrying"), since the parser can't tell it from a syllable break; small caps read as capitals. Scanned PDFs with no text layer are refused with a message.

### 5.4 Storage

IndexedDB database `virgil`, store `copies`, key = book id: `{ bookId, file: { name, size, type }, importedAt, chapters: string[][] (paragraphs per chapter), wordCounts }`. A small async store (`useYourCopy(bookId)`) reports availability to the UI. localStorage is not used for texts (a 5 MB quota and synchronous).

Privacy line on the import page: "Your file is read on this device and kept in this browser. It is never uploaded."

When the user's copy has real word counts, the planner uses them instead of the estimates (`wordCountsApproximate` books).

## 6. Listen: a narration lined up with the text

For books with a public-domain audiobook (Monte Cristo: LibriVox version 3, read by David Clarke, CC0), the reader has a **Listen** mode: the same page, driven by the voice instead of the timer.

**Data.** `book.json` gets `audio: { status: "shipped", source: "archive.org", item, filePattern, reader, license, url }`. Chapter n streams from `https://archive.org/download/<item>/<filePattern with NNN or NN, the zero-padded chapter>` (the 64 kbps files, about 30 MB an hour; archive.org serves them with range requests and CORS). `public/texts/<id>/sync/NNN.json` holds a start time for every token the reader shows: `{ duration, start, end, d: [ms deltas] }` (≈15 KB a chapter), and `audio.json` the chapter durations.

**Alignment pipeline** (offline, once per book, `scripts/audio/`):
1. `asr.py` downloads each chapter, decodes it with ffmpeg and runs faster-whisper (base.en, int8, word timestamps, VAD). About 0.045× real time on four CPU cores: 54 hours of narration in under three hours.
2. `sync.mjs` splits the chapter's tokens the way they're spoken ("three-master" → three, master), aligns them to the recognised words with Needleman–Wunsch (exact match 3, near match 2, mismatch −2, gap −1), takes the first matched piece's time for each token, forces times monotonic, and spreads unmatched tokens between their timed neighbours by reading weight. The LibriVox announcement before the text and the "end of chapter" after it simply don't match. It reports, per chapter, the share of tokens the recogniser confirmed and the longest unconfirmed run; chapter 1: 93%, 7 words.

**In the reader.**
- A headphones button in the top strip toggles Listen (remembered in prefs; `?mode=listen` opens it). The Aa sheet gains a Narration row: speed 0.7–2.0× and the reader credit.
- Play streams the chapter from the current token's time (and from the first word, skipping the announcement). A `requestAnimationFrame` loop maps the voice's time to the token being spoken (binary search) and drives the same `show()` as the flash timer. Safari updates `currentTime` only about four times a second, and 40% of the narration's words are shorter than that, so the clock is carried forward at the playback rate between ticks, and when a tick still jumps over words they are shown in turn (80 ms each) rather than skipped, so **Flash** flashes the spoken word and **Text** colours it and keeps the line being read on a soft guide band across the middle of the screen: the text moves up one line as the reading reaches the next line, never otherwise (a reader who scrolls gets four seconds before it resumes). Half a screen of padding above and below lets the first and last lines sit on the guide too. Seeking (scrubber, sentence skips, tapping a paragraph) moves the voice without stopping it.
- One shared `<audio>` element lives for the session. Media Session metadata and handlers give lock-screen play/pause, ±15 s and restart; the page does not pause the narration when hidden. With the screen off, `requestAnimationFrame` sleeps, so the place is saved from the element's `timeupdate` events instead (a few times a second). Closing the reader stops the narration; the place is kept.
- At the end of a chapter the next one starts at once, inside the `ended` event (so the gesture that started playback still counts), and its page takes over the playing element (the bookmark moves as with the end card). The next chapter is only started if its timing file exists; otherwise, and on the last chapter, the end card shows.
- Progress uses the narration: chapter time left from the sync, book time left from `audio.json`, both divided by the speed.
- Read and Listen share the token position, so switching modes keeps the place. If a chapter's timing file is missing, Listen falls back to Read with a toast.

### 6.1 Illustrations in the Text view

A few period pictures per book, shown inline in the Text view only. `public/texts/<id>/illustrations.json` lists them: `{ edition, source, license, credit, items: [{ chapter, from, to?, after?, file, width, height, caption }] }`. Each item names the **passage it depicts**: `from` (a phrase in the paragraph where the scene starts) and `to` (a phrase in the paragraph where it ends, the first match at or after `from`). While the reading is inside that passage, in Flash view or in Text view while following the voice, the picture is **pinned** in the top third of the screen with the words moving beneath it, so there is time to look at it; when the passage ends it goes. Inline in the Text view the picture sits after the passage (or after the paragraph holding `after`), so it never shows anything the reader hasn't reached. A phrase that doesn't match leaves the picture out (the validator fails on it, and on passages over 60 paragraphs). Files live in `public/texts/<id>/img/` as WebP, about 1000 px on the long side and ~220 KB, loaded lazily with width and height set so the page doesn't shift. In the light and sepia themes the engraving is multiplied onto the page, so its paper takes the page's colour; in the dark theme it is shown as a dimmed, slightly warm plate. Monte Cristo has 282 pictures: the wood engravings of the 1887 Routledge edition (after Gustave Staal, Janet-Lange and others; public domain, scanned by the Internet Archive and cut up on Wikimedia Commons) in 116 of its 117 chapters, usually two or three a chapter, plus nine from other sources for scenes the edition left out (Gavarni's 1846 portraits, Piranesi's Piazza del Popolo, Testard's Père-Lachaise, Daumier's courtroom, Sylvestre's *Locusta*, Pinelli's brigands), each with its own credit (`credit` on the item). Authoring and ingest: `scripts/illustrations/ingest.mjs` and the add-book skill's illustrations stage.

## 7. Spoiler rules

- Only chapters `≤ upTo + 1` are readable, in either view.
- The import review shows first words only for chapters `≤ upTo + 1`.
- The reader never shows Virgil's summaries, names or notes; the end card links to the chapter page, which is unlocked by then.
- The text itself is the book: nothing in the text layer is gated beyond the chapter rule.

## 8. Performance

- App bundle growth: the reader (~6 KB) and the text layer (~3 KB). Parsers are separate chunks: pdf.js ~400 KB gzipped (only on PDF import), fflate ~8 KB.
- Chapter text fetched on demand; the biggest Monte Cristo chapter is ~70 KB raw.
- The scheduler does one DOM update per word; no React re-render of the page per word (the word is set through a ref; the progress bar updates every 10 words).

## 9. Accessibility

- All controls are buttons with labels; speed and position are announced via `aria-valuetext` on the slider.
- Flash view respects `prefers-reduced-motion` (there are no animations anyway); the Text view is the alternative for anyone who can't use RSVP.
- Minimum tap targets 44 px; the word area is the biggest target.

## 10. Testing

- `npm test` runs node's test runner on the pure modules: `tests/rsvp.test.mjs` (tokens, pivot, timing, sentence boundaries, long-word split) and `tests/chapters.test.mjs` (title and numbered detection, review counts).
- `tests/e2e/reader.spec.ts` (Playwright): open reader for Up next, play, pause, seek, end card marks the chapter finished and continues; locked chapter; resume position; Text view tap moves position.
- `tests/e2e/import.spec.ts`: fixtures generated from 20,000 Leagues (`tests/fixtures/make.cjs` builds an EPUB and a PDF with running headers and page numbers); imports both, checks chapter count and that the first paragraphs match the shipped text.
- `scripts/check-pages.cjs` gains the reader and import pages.

## 11. Pipeline and docs

- `docs/data-format.md`: `text` field and `public/texts` layout.
- `.claude/skills/add-book/SKILL.md`: the text stage: run `export-text`, check the heading stripping on three chapters, set `text` in `book.json`.
- `scripts/pipeline/stages.mjs`: `text` stage (optional).

## 12. Later (database phase)

- Reading position and the imported copy sync through the user's account; the copy stays encrypted at rest and is only ever served back to its owner.
- Reading speed measured in the reader can feed the planner's estimates.
- Word-level position could drive Virgil's gating within a chapter (names introduced mid-chapter), which the data format doesn't support yet.
