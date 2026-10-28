import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

// Listen mode, with archive.org replaced by a local tone so the test needs no network.
const tone = readFileSync(fileURLToPath(new URL('../fixtures/tone.mp3', import.meta.url)))

async function open(page: Page, hash: string, progress: Record<string, number>) {
  await page.route('**/archive.org/**', (route) => {
    const m = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
    if (!m) return route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'accept-ranges': 'bytes' }, body: tone })
    const start = Number(m[1])
    const end = m[2] ? Number(m[2]) : tone.length - 1
    return route.fulfill({ status: 206, contentType: 'audio/mpeg', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${tone.length}` }, body: tone.subarray(start, end + 1) })
  })
  await page.goto('/')
  await page.evaluate((p) => {
    localStorage.setItem('virgil:progress:v1', JSON.stringify(p))
    localStorage.removeItem('virgil:reading:v1')
  }, progress)
  await page.goto('/' + hash)
  await page.reload()
}

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

test('listening follows the narration in both views and keeps the place', async ({ page }) => {
  await open(page, '#/b/monte-cristo/read/1?mode=listen', { 'monte-cristo': 0 })
  await expect(page.locator('.reader__listen')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.rsvp')).toHaveText('On')
  await expect(page.locator('.reader__progress')).toContainText('min left')

  await page.click('.reader__play')
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')
  // Playback starts at the first word (29 s in), not at the LibriVox announcement.
  await page.waitForTimeout(800)
  const t0 = await page.evaluate(() => (window as unknown as { __virgilPlayer: HTMLAudioElement }).__virgilPlayer.currentTime)
  expect(t0).toBeGreaterThan(28)
  const word0 = await page.locator('.rsvp').textContent()
  // Seek by sentence while playing: audio keeps going and the word moves.
  await page.click('[aria-label="Forward a sentence"]')
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')
  await expect(page.locator('.rsvp')).not.toHaveText(word0!)

  await page.getByRole('tab', { name: 'Text' }).click()
  await expect(page.locator('.reader__word')).toBeVisible()
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')

  await page.click('.reader__play')
  const pos = JSON.parse((await page.evaluate(() => localStorage.getItem('virgil:reading:v1')))!)
  expect(pos['monte-cristo'].chapter).toBe(1)
  expect(pos['monte-cristo'].word).toBeGreaterThan(0)

  // Switching to reading keeps the same word.
  await page.click('.reader__listen')
  await expect(page.locator('.reader__listen')).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('tab', { name: 'Flash' }).click()
  await expect(page.locator('.reader__wpm')).toContainText('wpm')
})

test('the Today page offers the narration', async ({ page }) => {
  await open(page, '#/b/monte-cristo', { 'monte-cristo': 0 })
  await expect(page.getByText('Listen · read by David Clarke')).toBeVisible()
})

test('when a chapter ends, the next one starts playing and the bookmark moves', async ({ page }) => {
  await open(page, '#/b/monte-cristo/read/1?mode=listen', { 'monte-cristo': 0 })
  await page.click('.reader__play')
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')
  // Jump the audio to its last second.
  await page.waitForFunction(() => Number.isFinite((window as unknown as { __virgilPlayer: HTMLAudioElement }).__virgilPlayer.duration))
  await page.evaluate(() => {
    const a = (window as unknown as { __virgilPlayer: HTMLAudioElement }).__virgilPlayer
    a.currentTime = a.duration - 1
  })
  await expect(page.locator('.reader__label')).toContainText('Chapter 2', { timeout: 10_000 })
  await expect(page.locator('.reader__play')).toHaveAttribute('aria-label', 'Pause')
  const progress = JSON.parse((await page.evaluate(() => localStorage.getItem('virgil:progress:v1')))!)
  expect(progress['monte-cristo']).toBe(1)
  await expect(page.locator('.toast')).toContainText('Chapter 1 done')
})

for (const coarse of [false, true]) {
  test(`Flash shows every word the voice passes${coarse ? ', even when the audio clock ticks only four times a second (Safari)' : ''}`, async ({ page }) => {
    await open(page, '#/b/monte-cristo/read/1?mode=listen', { 'monte-cristo': 0 })
    if (coarse)
      await page.evaluate(() => {
        const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
          get() {
            return Math.floor(d.get!.call(this) * 4) / 4
          },
          set(v: number) {
            d.set!.call(this, v)
          },
        })
      })
    await page.click('.reader__play')
    await page.waitForFunction(() => !(window as unknown as { __virgilPlayer: HTMLAudioElement }).__virgilPlayer.paused)
    // Record the distinct words painted over a stretch, and the audio time at each end.
    const result = await page.evaluate(
      () =>
        new Promise<{ t0: number; t1: number; seen: number }>((resolve) => {
          const a = (window as unknown as { __virgilPlayer: HTMLAudioElement }).__virgilPlayer
          const el = document.querySelector('.rsvp')!
          let seen = 0
          let last = el.textContent
          const mo = new MutationObserver(() => {
            if (el.textContent !== last) ((last = el.textContent), seen++)
          })
          mo.observe(el, { childList: true, characterData: true, subtree: true })
          const t0 = a.currentTime
          setTimeout(() => {
            mo.disconnect()
            resolve({ t0, t1: a.currentTime, seen })
          }, 6000)
        }),
    )
    const sync = (await (await page.request.get('/texts/monte-cristo/sync/001.json')).json()) as { d: number[] }
    let t = 0
    const times = sync.d.map((d) => (t += d) / 1000)
    const passed = times.filter((x) => x > result.t0 && x <= result.t1).length
    expect(passed).toBeGreaterThan(8)
    // A little slack for words sharing a timestamp and the one still being caught up at the end.
    expect(result.seen).toBeGreaterThanOrEqual(passed * 0.9)
  })
}
