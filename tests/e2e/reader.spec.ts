import { test, expect, type Page } from '@playwright/test'

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

test('text view shows the chapter and tapping a paragraph moves the position', async ({ page }) => {
  await open(page, '#/b/twenty-thousand-leagues/read/1', { 'twenty-thousand-leagues': 0 })
  await page.getByRole('tab', { name: 'Text' }).click()
  const paras = page.locator('.reader__text p')
  expect(await paras.count()).toBeGreaterThan(5)
  const first = (await paras.nth(2).textContent())!.split(' ')[0]
  await paras.nth(2).click()
  await expect(page.locator('.rsvp')).toBeVisible()
  await expect(page.locator('.rsvp')).toHaveText(first)
})

test('chapters past the bookmark are locked; copyrighted books ask for a copy', async ({ page }) => {
  await open(page, '#/b/monte-cristo/read/9', { 'monte-cristo': 2 })
  await expect(page.getByText('Chapter 9 is still ahead of you')).toBeVisible()
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
  expect(before).toContain('tell me at least to hope')
  // And it really loads.
  await figures.first().scrollIntoViewIfNeeded()
  await expect.poll(() => figures.first().locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
})
