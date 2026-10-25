import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// The fixtures are six chapters of 20,000 Leagues (public domain), imported into The Pearl,
// which also has six chapters. node tests/fixtures/make.cjs rebuilds them.
const fixture = (name: string) => fileURLToPath(new URL('../fixtures/' + name, import.meta.url))

async function open(page: Page, hash: string, progress: Record<string, number>) {
  await page.goto('/')
  await page.evaluate((p) => localStorage.setItem('virgil:progress:v1', JSON.stringify(p)), progress)
  await page.evaluate(() => new Promise((r) => (indexedDB.deleteDatabase('virgil').onsuccess = r)))
  await page.goto('/' + hash)
  await page.reload()
}

for (const file of ['leagues.epub', 'leagues.pdf', 'leagues.txt']) {
  test(`imports ${file} and lines its chapters up`, async ({ page }) => {
    await open(page, '#/b/the-pearl/text', { 'the-pearl': 1 })
    await expect(page.getByText('Your copy of the book')).toBeVisible()
    await page.locator('input[type=file]').setInputFiles(fixture(file))
    await expect(page.getByText('Check the chapters')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('found 6')).toBeVisible()
    // Chapters past the bookmark show no text.
    const rows = page.locator('.group .row')
    await expect(rows).toHaveCount(6)
    await expect(rows.nth(0)).toContainText('THE YEAR 1866')
    await expect(rows.nth(1)).toContainText('DURING THE PERIOD')
    await expect(rows.nth(2)).toContainText('Still ahead of you')
    await page.getByText('Use these 6 chapters').click()
    await expect(page.locator('.rsvp')).toBeVisible()
    await expect(page.locator('.reader__label')).toContainText('Chapter 2')
    await page.getByRole('tab', { name: 'Text' }).click()
    await expect(page.locator('.reader__text p').first()).toContainText('DURING THE PERIOD')
    // Running heads and page numbers must not have leaked into the text.
    const text = await page.locator('.reader__text').textContent()
    expect(text).not.toMatch(/TWENTY THOUSAND LEAGUES UNDER THE SEAS/)
    expect(text).not.toMatch(/\s\d{1,2}\s[A-Z]/)
  })
}

test('a file whose chapters do not match asks the reader to fix them', async ({ page }) => {
  await open(page, '#/b/harry-potter-1/text', { 'harry-potter-1': 3 })
  await page.locator('input[type=file]').setInputFiles(fixture('leagues.epub'))
  await expect(page.getByText('couldn’t line the file up with 17 chapters')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('6 of 17 chapters marked')).toBeVisible()
  await expect(page.locator('.candidate')).toHaveCount(await page.locator('.candidate').count())
  // Headings after the bookmark are blurred until tapped.
  await expect(page.locator('.is-blurred').first()).toBeVisible()
  await page.locator('.candidate input:checked').first().uncheck()
  await expect(page.getByText('5 of 17 chapters marked')).toBeVisible()
})

test('the imported copy survives a reload and can be removed', async ({ page }) => {
  await open(page, '#/b/the-pearl/text', { 'the-pearl': 1 })
  await page.locator('input[type=file]').setInputFiles(fixture('leagues.epub'))
  await page.getByText('Use these 6 chapters').click({ timeout: 30_000 })
  await expect(page.locator('.rsvp')).toBeVisible()
  await page.goto('/#/b/the-pearl')
  await page.reload()
  await expect(page.getByText('Read chapter 2')).toBeVisible()
  await page.goto('/#/b/the-pearl/text')
  await expect(page.getByText('leagues.epub')).toBeVisible()
  await page.getByText('Remove').click()
  await expect(page.getByText('leagues.epub')).toHaveCount(0)
  await page.goto('/#/b/the-pearl')
  await expect(page.getByText('Add your copy to read it here')).toBeVisible()
})
