import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenAt, timeOf } from '../src/lib/audio.ts'

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
