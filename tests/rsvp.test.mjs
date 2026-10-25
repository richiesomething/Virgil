import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenize, pivotIndex, weightOf, sentenceStartBefore, sentenceStartAfter, rampFactor, msFor } from '../src/lib/rsvp.ts'

test('pivot follows the length table and skips leading punctuation', () => {
  assert.equal(pivotIndex('a'), 0)
  assert.equal(pivotIndex('the'), 1)
  assert.equal(pivotIndex('reader'), 2)
  assert.equal(pivotIndex('remarkable'), 3)
  assert.equal(pivotIndex('incomprehensible'), 4)
  assert.equal(pivotIndex('“the'), 2)
  assert.equal(pivotIndex('“I'), 1)
  assert.equal(pivotIndex('—'), 0)
})

test('punctuation and length lengthen the pause', () => {
  assert.equal(weightOf('cat', false), 1)
  assert.equal(weightOf('cat,', false), 1.5)
  assert.equal(weightOf('cat.', false), 2)
  assert.equal(weightOf('cat.”', false), 2)
  assert.equal(weightOf('cat', true), 2.5)
  assert.ok(weightOf('extraordinary', false) > 1 && weightOf('extraordinary', false) < 2)
  assert.equal(weightOf('1815', false), 1.3)
})

test('tokenizes paragraphs into words, sentences and paragraphs', () => {
  const c = tokenize(['On the 24th of February, 1815, the look-out signalled. As usual, a pilot put off.', 'Second paragraph here.'])
  assert.equal(c.tokens.length, 18)
  assert.deepEqual(c.paragraphStarts, [0, 15])
  assert.deepEqual(c.sentenceStarts, [0, 9, 15])
  assert.equal(c.tokens[8].text, 'signalled.')
  assert.equal(c.tokens[8].sentence, 0)
  assert.equal(c.tokens[9].sentence, 1)
  assert.equal(c.tokens[14].weight, 2.5)
  assert.equal(c.tokens[17].paragraph, 1)
  assert.equal(c.tokens[9].offset, 'On the 24th of February, 1815, the look-out signalled. '.length)
})

test('abbreviations do not end sentences', () => {
  const c = tokenize(['Mr. Morrel spoke to M. de Villefort. Then he left.'])
  assert.deepEqual(c.sentenceStarts, [0, 7])
})

test('em dashes split joined words and long words are halved', () => {
  const c = tokenize(['Marseilles—The Arrival', 'incomprehensibilities today'])
  assert.deepEqual(
    c.tokens.map((t) => t.text),
    ['Marseilles—', 'The', 'Arrival', 'incomprehen-', 'sibilities', 'today'],
  )
  assert.equal(Math.round(c.tokens[0].weight * 10) / 10, 1.8) // long word (1.2) ending in a dash (1.5)
})

test('lone closing quotes attach to the previous word', () => {
  const c = tokenize(['“Wait and hope ”', 'done'])
  assert.deepEqual(c.tokens.map((t) => t.text), ['“Wait', 'and', 'hope”', 'done'])
})

test('sentence navigation', () => {
  const c = tokenize(['One two. Three four. Five six.'])
  assert.equal(sentenceStartBefore(c, 3), 2)
  assert.equal(sentenceStartBefore(c, 2), 2)
  assert.equal(sentenceStartBefore(c, 2, true), 0)
  assert.equal(sentenceStartBefore(c, 0, true), 0)
  assert.equal(sentenceStartAfter(c, 2), 4)
  assert.equal(sentenceStartAfter(c, 5), 6)
})

test('timing', () => {
  const c = tokenize(['cat sat.'])
  assert.equal(msFor(c.tokens[0], 300), 200)
  assert.equal(msFor(c.tokens[1], 300), 500)
  assert.equal(rampFactor(0), 2)
  assert.equal(rampFactor(3), 1.5)
  assert.equal(rampFactor(6), 1)
})

test('empty and whitespace paragraphs are skipped', () => {
  const c = tokenize(['', '   ', 'x'])
  assert.equal(c.tokens.length, 1)
  assert.deepEqual(c.paragraphStarts, [0])
  assert.equal(c.tokens[0].paragraph, 2)
})
