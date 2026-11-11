import { test, expect, type Page } from '@playwright/test'

// These tests were written for the Flash view; the reader now opens in Text view unless the reader chose Flash.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    const p = JSON.parse(localStorage.getItem('virgil:prefs:v1') || '{}')
    if (!('readerView' in p)) localStorage.setItem('virgil:prefs:v1', JSON.stringify({ ...p, readerView: 'flash' }))
  })
})

/** Set the bookmark before the app loads (progress is read once at startup). */
async function open(page: Page, hash: string, progress: Record<string, number>) {
  await page.goto('/')
  await page.evaluate((p) => localStorage.setItem('virgil:progress:v1', JSON.stringify(p)), progress)
  await page.goto('/' + hash)
  await page.reload()
}

const seek = async (page: Page, to: number) =>
  page.$eval(
    '.reader__bar',
    (e, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(e, v)
      e.dispatchEvent(new Event('input', { bubbles: true }))
    },
    String(to),
  )

test('reads the up-next chapter, pauses, keeps the position, and marks it finished at the end', async ({ page }) => {
  await open(page, '#/b/monte-cristo/read/3', { 'monte-cristo': 2 })
  await expect(page.locator('.rsvp')).toContainText('Beyond')
  await expect(page.locator('.reader__label')).toContainText('Chapter 3')

  await page.click('.reader__play')
  await page.waitForTimeout(1500)
  await page.click('.reader__play')
  const word = await page.locator('.rsvp').textContent()
  expect(word).not.toBe('Beyond')
  const pos = JSON.parse(await page.evaluate(() => localStorage.getItem('virgil:reading:v1')!))
  expect(pos['monte-cristo'].chapter).toBe(3)
  expect(pos['monte-cristo'].word).toBeGreaterThan(0)

  // Reopening resumes at the saved word.
  await page.goto('/#/b/monte-cristo')
  await page.goto('/#/b/monte-cristo/read/3')
  await expect(page.locator('.rsvp')).toHaveText(word!)

  // The end card moves the bookmark and opens the next chapter.
  const max = Number(await page.$eval('.reader__bar', (e) => (e as HTMLInputElement).max))
  await seek(page, max - 1)
  await page.click('.reader__play')
  await expect(page.getByText('Finished · read Chapter 4')).toBeVisible({ timeout: 10_000 })
  await page.getByText('Finished · read Chapter 4').click()
  await expect(page.locator('.reader__label')).toContainText('Chapter 4')
  await expect(page.locator('.toast')).toContainText('Chapter 3 done')
  const progress = JSON.parse(await page.evaluate(() => localStorage.getItem('virgil:progress:v1')!))
  expect(progress['monte-cristo']).toBe(3)
})

test('text view is a page to scroll: the position follows the scroll, survives a reload, and Flash picks up there', async ({ page }) => {
  await open(page, '#/b/twenty-thousand-leagues/read/1', { 'twenty-thousand-leagues': 0 })
  await page.getByRole('tab', { name: 'Text' }).click()
  const paras = page.locator('.reader__text p')
  expect(await paras.count()).toBeGreaterThan(5)
  // No play controls while reading by scrolling; tapping the text doesn't switch views.
  await expect(page.locator('.reader__play')).toHaveCount(0)
  await paras.nth(2).click()
  await expect(page.locator('.reader__text')).toBeVisible()
  // Scroll so paragraph 6 is at the top.
  const first = (await paras.nth(6).textContent())!.split(' ')[0]
  await page.locator('.reader__text').evaluate((box) => {
    const p = box.querySelectorAll('p')[6] as HTMLElement
    box.scrollTop = p.offsetTop - 4
  })
  await expect(page.locator('.reader__progress')).not.toContainText('· 0%')
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator('.reader__text')).toBeVisible()
  await expect.poll(() => page.locator('.reader__text').evaluate((b) => b.scrollTop)).toBeGreaterThan(100)
  await page.getByRole('tab', { name: 'Flash' }).click()
  await expect(page.locator('.rsvp')).toHaveText(first)
  // The bottom of the page offers to finish the chapter.
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.locator('.reader__text').evaluate((b) => (b.scrollTop = b.scrollHeight))
  await page.getByRole('button', { name: 'Finish Chapter 1' }).click()
  await expect(page.getByText('The end of')).toBeVisible()
})

test('with the spoiler guard on, chapters past the bookmark can be read, but finishing one does not move the bookmark by itself', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('virgil:prefs:v1', JSON.stringify({ reveal: { 'monte-cristo': false } })))
  await open(page, '#/b/monte-cristo/read/9', { 'monte-cristo': 2 })
  await expect(page.locator('.reader__label')).toContainText('Chapter 9')
  await expect(page.locator('.rsvp')).not.toBeEmpty()
  // Jump to the end of the chapter.
  await page.locator('input[aria-label="Position in the chapter"]').evaluate((el: HTMLInputElement) => {
    // React only notices a value set through the native setter.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, el.max)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.keyboard.press(' ') // play the last word: the chapter ends
  await expect(page.getByRole('button', { name: /Next chapter/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Move my bookmark to chapter 9' })).toBeVisible()
  const progress = JSON.parse((await page.evaluate(() => localStorage.getItem('virgil:progress:v1')))!)
  expect(progress['monte-cristo']).toBe(2)
  // The chapter page keeps its notes hidden but offers the text.
  await page.goto('/#/b/monte-cristo/chapters/9')
  await expect(page.getByText('Chapter 9 is still ahead of you')).toBeVisible()
  await expect(page.getByText('Read chapter 9')).toBeVisible()
  await page.goto('/#/b/the-pearl/read/1')
  await expect(page.getByText('Add your copy')).toBeVisible()
})

test('the Today tab offers to read the next chapter, with a percentage once started', async ({ page }) => {
  await open(page, '#/b/monte-cristo', { 'monte-cristo': 2 })
  await expect(page.getByText('Read chapter 3')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('virgil:reading:v1', JSON.stringify({ 'monte-cristo': { chapter: 3, word: 500, words: 1000, updatedAt: '' } })))
  await page.reload()
  await expect(page.getByText('Continue reading · 50%')).toBeVisible()
})

test('keyboard: space plays and pauses, arrows move by sentence and change speed', async ({ page }) => {
  await open(page, '#/b/monte-cristo/read/1', { 'monte-cristo': 0 })
  await expect(page.locator('.rsvp')).toHaveText('On')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.rsvp')).toHaveText('As')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.rsvp')).toHaveText('On')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.reader__wpm')).toContainText('325')
  await page.keyboard.press('Space')
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')
  await page.keyboard.press('Space')
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Play')
})

test('the Aa sheet changes the text size in Text view, and it is remembered', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('virgil:progress:v1', JSON.stringify({ 'monte-cristo': 2 })))
  await page.goto('/#/b/monte-cristo/read/3')
  await page.reload()
  await page.getByRole('tab', { name: 'Text' }).click()
  const size = () => page.locator('.reader__text p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const before = await size()
  await page.getByRole('button', { name: 'Reading settings' }).click()
  await page.getByRole('button', { name: 'Larger text' }).click()
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(page.getByRole('group', { name: 'Text size' })).toContainText('120%')
  expect(await size()).toBeCloseTo(before * 1.2, 0)
  await page.reload()
  await page.getByRole('tab', { name: 'Text' }).click()
  expect(await size()).toBeCloseTo(before * 1.2, 0)
})

test('chapter 14 of Monte Cristo shows its period illustrations after the paragraphs they depict, in Text view only', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('virgil:progress:v1', JSON.stringify({ 'monte-cristo': 13 })))
  await page.goto('/#/b/monte-cristo/read/14')
  await page.reload()
  await expect(page.locator('.rsvp')).not.toBeEmpty()
  await expect(page.locator('.reader__figure')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Text' }).click()
  const figures = page.locator('.reader__figure')
  await expect(figures).toHaveCount(3)
  await expect(figures.first().locator('img')).toHaveAttribute('alt', /on his knees/)
  // The first picture comes right after the paragraph it depicts.
  const before = await figures.first().evaluate((f) => f.previousElementSibling?.textContent ?? '')
  expect(before).toContain('Dantès fell on his knees')
  // And it really loads.
  await figures.first().scrollIntoViewIfNeeded()
  await expect.poll(() => figures.first().locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
})

test('the chapter picker opens from the reader, the chapters tab and Today, and goes straight to a chapter', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('virgil:progress:v1', JSON.stringify({ 'monte-cristo': 5 })))
  // From the reader's chapter label: back to a read chapter.
  await page.goto('/#/b/monte-cristo/read/6')
  await page.reload()
  await page.getByRole('button', { name: /Choose another chapter/ }).click()
  await expect(page.getByRole('heading', { name: 'Which chapter?' })).toBeVisible()
  await page.getByLabel('Jump to chapter number').fill('2')
  await page.getByLabel('Jump to chapter number').press('Enter')
  await expect(page.locator('.reader__label')).toContainText('Chapter 2')
  // Ahead of the bookmark too, by number.
  await page.getByRole('button', { name: /Choose another chapter/ }).click()
  await page.getByLabel('Jump to chapter number').fill('40')
  await page.getByLabel('Jump to chapter number').press('Enter')
  await expect(page.locator('.reader__label')).toContainText('Chapter 40')
  await expect(page.locator('.rsvp')).not.toBeEmpty()
  // From Today and the chapters tab.
  await page.goto('/#/b/monte-cristo')
  await page.getByRole('button', { name: 'Read a different chapter' }).click()
  await expect(page.getByRole('heading', { name: 'Which chapter?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/#/b/monte-cristo/chapters')
  await page.getByRole('button', { name: 'Read or listen to any chapter' }).click()
  await expect(page.getByRole('heading', { name: 'Which chapter?' })).toBeVisible()
})

test('Monte Cristo opens with the spoiler guard off: every chapter page is readable, the bookmark still drives Today; the switch turns the guard on', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('virgil:progress:v1', JSON.stringify({ 'monte-cristo': 2 })))
  await page.goto('/#/b/monte-cristo/chapters/40')
  await page.reload()
  await expect(page.getByText('Chapter 40 is still ahead of you')).toHaveCount(0)
  await expect(page.locator('h1')).toContainText(/.+/)
  await expect(page.getByText('Read chapter 40')).toBeVisible()
  await page.goto('/#/b/monte-cristo')
  await expect(page.getByText('Read chapter 3')).toBeVisible()
  // The chapters tab lists them all; the header pill still says where the bookmark is.
  await page.goto('/#/b/monte-cristo/chapters')
  expect(await page.locator('.group .ch-row').count()).toBeGreaterThanOrEqual(117)
  await expect(page.getByText('2 of 117 read')).toBeVisible()
  // Turn the guard back on from the bookmark sheet.
  await page.getByRole('button', { name: /Bookmark: finished chapter 2/ }).click()
  await page.getByText('Hide chapters ahead of my bookmark').click()
  await page.keyboard.press('Escape')
  await page.goto('/#/b/monte-cristo/chapters/40')
  await expect(page.getByText('Chapter 40 is still ahead of you')).toBeVisible()
})

test('the chapter guide opens a chapter’s insights inside the reader, and only once the chapter is reached', async ({ page }) => {
  await open(page, '#/b/twenty-thousand-leagues/read/3', { 'twenty-thousand-leagues': 5 })
  await page.getByRole('button', { name: /Chapter 3 guide/ }).click()
  const sheet = page.locator('.sheet')
  await expect(sheet.locator('.insight').first()).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Open the chapter page/ })).toHaveAttribute('href', /chapters\/3\?tab=insights/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.reader__label')).toContainText('Chapter 3')

  await page.goto('/#/b/twenty-thousand-leagues/read/6')
  await page.getByRole('button', { name: /Chapter 6 guide/ }).click()
  await expect(page.locator('.sheet')).toContainText('open once you’ve finished it')
  await expect(page.locator('.sheet .insight')).toHaveCount(0)
})
