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
  const chapters = splitChapters(paras, d.starts, ['The Boy Who Lived', 'The Vanishing Glass'])
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

test('a table of contents at the front is skipped', () => {
  const paras = P(['Contents', 'Chapter 1. Alpha', 'Chapter 2. Beta', 'Chapter 1. Alpha', 'Text of one.', 'More of one.', 'Chapter 2. Beta', 'Text of two.', 'More of two.'])
  const byTitle = detectChapters(paras, ['Alpha', 'Beta'], 2)
  assert.equal(byTitle.method, 'titles')
  assert.deepEqual(byTitle.starts, [3, 6])
  const numbered = detectChapters(paras, ['', ''], 2)
  assert.equal(numbered.method, 'numbered')
  assert.deepEqual(numbered.starts, [3, 6])
})

test('a short first line of text is kept; heading lines are not', () => {
  const paras = P(['Chapter 1', 'The Catalans', 'Yes', 'He went on.'])
  assert.deepEqual(splitChapters(paras, [0], ['The Catalans']), [['Yes', 'He went on.']])
  assert.deepEqual(splitChapters(P(['CHAPTER ONE', { text: 'The Boy Who Lived', heading: true }, 'Mr. Dursley.']), [0]), [['Mr. Dursley.']])
})

test('"Part of the crew" is not a heading', () => {
  assert.ok(!looksLikeHeading({ text: 'Part of the crew went below.' }))
  assert.ok(looksLikeHeading({ text: 'Part Two' }))
  assert.ok(looksLikeHeading({ text: 'Chapter' }))
  assert.equal(headingNumber('Letter to the editor'), null)
})

test('number words and merged number-title lines', () => {
  assert.equal(stripNumber('Chapter One: A Runaway Reef'), 'A Runaway Reef')
  assert.equal(stripNumber('4 Ned Land'), 'Ned Land')
  assert.equal(stripNumber('Seven'), 'Seven')
  assert.equal(stripNumber('CHAPTER ONE'), '')
  assert.equal(headingNumber('4 Ned Land', true), 4)
  assert.equal(headingNumber('4 Ned Land'), null)
  assert.ok(looksLikeHeading({ text: '1.' }))
  assert.ok(looksLikeHeading({ text: 'IV' }))
})

test('titles ending in ! or ? are matched, and dropped from the chapter text', () => {
  const paras = P(['CHAPTER 1', 'At Random!', 'For some while nothing happened.', 'CHAPTER 2', 'At Full Steam', 'Later.'])
  const d = detectChapters(paras, ['At Random!', 'At Full Steam'], 2)
  assert.equal(d.method, 'titles')
  assert.deepEqual(splitChapters(paras, d.starts, ['At Random!', 'At Full Steam']), [['For some while nothing happened.'], ['Later.']])
  // Unknown titles: the line after a bare number line is still treated as the title.
  const d2 = detectChapters(paras, ['', ''], 2)
  assert.deepEqual(splitChapters(paras, d2.starts), [['For some while nothing happened.'], ['Later.']])
})

test('back matter after the last chapter is cut off', () => {
  const paras = P(['Chapter 1', 'One.', 'More.', 'Chapter 2', 'Two.', 'More two.', { text: 'About the Author', heading: true }, 'Jules Verne was born in Nantes.'])
  const d = detectChapters(paras, ['', ''], 2)
  assert.deepEqual(splitChapters(paras, d.starts), [['One.', 'More.'], ['Two.', 'More two.']])
})
