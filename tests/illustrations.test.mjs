import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeIllustrations } from '../src/lib/illustrations.ts'

const items = [
  { chapter: 14, after: 'tell me at least to hope', file: 'a.webp', width: 1, height: 1, caption: 'A' },
  { chapter: 14, after: '“Nothing to be done.”', file: 'b.webp', width: 1, height: 1, caption: 'B' },
  { chapter: 15, after: 'tell me at least to hope', file: 'c.webp', width: 1, height: 1, caption: 'C' },
  { chapter: 14, after: 'not in this chapter', file: 'd.webp', width: 1, height: 1, caption: 'D' },
]
const paragraphs = ['He said: tell me at least to hope.', 'Another paragraph.', 'He simply wrote, "Nothing to be done."']

test('each illustration follows the first paragraph holding its phrase; quotes and case are forgiven', () => {
  const m = placeIllustrations(items, 14, paragraphs)
  assert.deepEqual([...m.keys()], [0, 2])
  assert.equal(m.get(0)[0].file, 'a.webp')
  assert.equal(m.get(2)[0].file, 'b.webp')
})

test('illustrations for other chapters and unmatched anchors are left out', () => {
  const m = placeIllustrations(items, 14, paragraphs)
  const files = [...m.values()].flat().map((x) => x.file)
  assert.ok(!files.includes('c.webp') && !files.includes('d.webp'))
  assert.equal(placeIllustrations(items, 16, paragraphs).size, 0)
})
