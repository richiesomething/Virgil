import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectChapters, headingNumber, looksLikeHeading, parseNumber, splitChapters, stripNumber } from '../src/lib/import/chapters.ts'

const P = (texts) => texts.map((t) => (typeof t === 'string' ? { text: t } : t))

test('numbers in words, roman and digits', () => {
  assert.equal(parseNumber('12'), 12)
  assert.equal(parseNumber('XIV'), 14)
  assert.equal(parseNumber('seven'), 7)
  assert.equal(parseNumber('Twenty-One'), 21)
  assert.equal(parseNumber('thirty three'), 33)
  assert.equal(parseNumber('dawn'), null)
})

test('heading numbers', () => {
  assert.equal(headingNumber('CHAPTER ONE'), 1)
  assert.equal(headingNumber('Chapter 12. The Mirror of Erised'), 12)
  assert.equal(headingNumber('XIV'), 14)
  assert.equal(headingNumber('3'), 3)
  assert.equal(headingNumber('Part Two'), 2)
  assert.equal(headingNumber('One day it rained'), null)
  assert.equal(headingNumber('The Boy Who Lived'), null)
  assert.equal(headingNumber('Seven'), 7)
})

test('heading shape', () => {
  assert.ok(looksLikeHeading({ text: 'The Boy Who Lived' }))
  assert.ok(looksLikeHeading({ text: 'At Random!', heading: true }))
  assert.ok(!looksLikeHeading({ text: 'At Random!' }))
  assert.ok(!looksLikeHeading({ text: 'He turned and walked away from the house, slowly.' }))
  assert.equal(stripNumber('Chapter 3. The Catalans'), 'The Catalans')
  assert.equal(stripNumber('CHAPTER XII — The Mirror'), 'The Mirror')
})

test('known titles line up, including a number line before each title', () => {
  const paras = P(['Harry Potter', 'by J.K. Rowling', 'CHAPTER ONE', 'The Boy Who Lived', 'Mr. and Mrs. Dursley were proud.', 'CHAPTER TWO', 'The Vanishing Glass', 'Nearly ten years passed.', 'The end.'])
  const d = detectChapters(paras, ['The Boy Who Lived', 'The Vanishing Glass'], 2)
  assert.equal(d.method, 'titles')
  assert.deepEqual(d.starts, [2, 5])
  const chapters = splitChapters(paras, d.starts)
  assert.deepEqual(chapters, [['Mr. and Mrs. Dursley were proud.'], ['Nearly ten years passed.', 'The end.']])
})

test('titles are matched loosely (case, punctuation, chapter prefix)', () => {
  const paras = P(['Chapter 1: Marseilles — The Arrival', 'Text one.', 'CHAPTER 2. FATHER AND SON', 'Text two.'])
  const d = detectChapters(paras, ['Marseilles—The Arrival', 'Father and Son'], 2)
  assert.equal(d.method, 'titles')
  assert.deepEqual(d.starts, [0, 2])
})

test('falls back to numbered headings when titles are unknown', () => {
  const paras = P(['Preface', 'Some words.', 'I', 'First text.', 'Interlude 2 is not a chapter.', 'II', 'Second text.', 'III', 'Third text.'])
  const d = detectChapters(paras, ['', '', ''], 3)
  assert.equal(d.method, 'numbered')
  assert.deepEqual(d.starts, [2, 5, 7])
})

test('reports failure with candidates when the count is off', () => {
  const paras = P(['Chapter 1', 'a.', 'Chapter 2', 'b.', 'Chapter 4', 'c.'])
  const d = detectChapters(paras, ['', '', ''], 3)
  assert.equal(d.method, 'none')
  assert.deepEqual(d.starts, [0, 2]) // chapters 1 and 2 were found; 4 is not 3
  assert.deepEqual(d.candidates, [0, 2, 4])
})

test('a chapter title that is itself a number word is not mistaken for a heading number', () => {
  const paras = P(['Chapter 1', 'Seven', 'The seven dwarfs were tired.', 'Chapter 2', 'More.'])
  const d = detectChapters(paras, ['Seven', ''], 2)
  assert.deepEqual(d.starts, [0, 3])
})
