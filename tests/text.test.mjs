import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitParagraphs } from '../src/lib/import/paragraphs.ts'

test('hard-wrapped text with blank lines between paragraphs', () => {
  assert.deepEqual(splitParagraphs('One two\nthree.\n\nFour\nfive.\r\n\r\nSix.'), ['One two three.', 'Four five.', 'Six.'])
})

test('one long line per paragraph, no blank lines', () => {
  const para = (i) => `Paragraph ${i} ` + 'word '.repeat(40)
  const text = Array.from({ length: 60 }, (_, i) => para(i)).join('\n')
  assert.equal(splitParagraphs(text).length, 60)
})
