import { test } from 'node:test'
import assert from 'node:assert/strict'
import { narrationLeft, tokenAt, timeOf } from '../src/lib/audio.ts'

const sync = { duration: 100, start: 10, end: 90, times: Float64Array.from([10, 10.5, 12, 12, 15, 40, 88]) }

test('tokenAt finds the word being spoken', () => {
  assert.equal(tokenAt(sync, 0), 0)
  assert.equal(tokenAt(sync, 10), 0)
  assert.equal(tokenAt(sync, 10.7), 1)
  assert.equal(tokenAt(sync, 12), 3) // two tokens share a start: the later one
  assert.equal(tokenAt(sync, 30), 4)
  assert.equal(tokenAt(sync, 500), 6)
})

test('timeOf clamps to the chapter', () => {
  assert.equal(timeOf(sync, -5), 10)
  assert.equal(timeOf(sync, 99), 88)
  assert.equal(timeOf(sync, 4), 15)
})

test('narrationLeft estimates chapters without a measured duration instead of counting them as zero', () => {
  const sync = { duration: 100, start: 2, end: 90, times: new Float64Array([2, 10, 20, 30]) }
  const book = { wordCounts: [1000, 1500, 3000] }
  const partial = narrationLeft(book, sync, 1, 1, 1, [600, null, null])
  assert.equal(partial.chapter, 80)
  assert.equal(partial.book, 80 + 1500 / 2.5 + 3000 / 2.5)
  const full = narrationLeft(book, sync, 1, 1, 2, [600, 700, 800])
  assert.equal(full.book, (80 + 1500) / 2)
})
