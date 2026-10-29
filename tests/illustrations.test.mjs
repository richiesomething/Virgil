import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeIllustrations, pinnedAt } from '../src/lib/illustrations.ts'

const items = [
  { chapter: 14, from: 'tell me at least', to: '“Nothing to be done.”', file: 'a.webp', width: 1, height: 1, caption: 'A' },
  { chapter: 14, from: 'Another paragraph', file: 'b.webp', width: 1, height: 1, caption: 'B' },
  { chapter: 15, from: 'tell me at least', file: 'c.webp', width: 1, height: 1, caption: 'C' },
  { chapter: 14, from: 'not in this chapter', file: 'd.webp', width: 1, height: 1, caption: 'D' },
  { chapter: 14, from: 'Nothing to be done', to: 'tell me at least', file: 'e.webp', width: 1, height: 1, caption: 'E: end before start' },
]
const paragraphs = ['He said: tell me at least to hope.', 'Another paragraph.', 'He simply wrote, "Nothing to be done."', 'Later.']

test('a passage runs from the first paragraph holding "from" to the first holding "to" after it; quotes and case are forgiven', () => {
  const placed = placeIllustrations(items, 14, paragraphs)
  assert.deepEqual(placed.map((p) => [p.item.file, p.from, p.to, p.after]), [['a.webp', 0, 2, 2], ['b.webp', 1, 1, 1]])
})

test('other chapters, unmatched phrases and an end before the start are left out', () => {
  const files = placeIllustrations(items, 14, paragraphs).map((p) => p.item.file)
  assert.ok(!files.includes('c.webp') && !files.includes('d.webp') && !files.includes('e.webp'))
  assert.equal(placeIllustrations(items, 16, paragraphs).length, 0)
})

test('pinnedAt gives the picture whose passage the paragraph is in', () => {
  const placed = placeIllustrations(items, 14, paragraphs)
  assert.equal(pinnedAt(placed, 0).item.file, 'a.webp')
  assert.equal(pinnedAt(placed, 1).item.file, 'a.webp') // the earlier, longer passage wins while both apply
  assert.equal(pinnedAt(placed, 2).item.file, 'a.webp')
  assert.equal(pinnedAt(placed, 3), null)
})
