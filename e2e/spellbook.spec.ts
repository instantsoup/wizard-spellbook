import { expect, test } from '@playwright/test'
import { autoConfirm, createEvoker, failOnErrors, learn } from './helpers'

test('new wizard gets cantrips and starting spells', async ({ page }) => {
  const noErrors = failOnErrors(page)
  await createEvoker(page)
  // 19 cantrips minus Daze (Enchantment) and Ghost Sound (Illusion), plus 2 chosen
  await expect(page.locator('header')).toContainText('19 spells')
  await page.reload()
  await expect(page.locator('header')).toContainText('19 spells')
  noErrors()
})

test('library: free pick, paid spell, prohibited and above-level spells, fixed cost, no sideways scrolling', async ({ page }) => {
  const noErrors = failOnErrors(page)
  await createEvoker(page)
  await learn(page, 'Fireball') // level-5 free pick by default
  await learn(page, 'Haste', 'From a scroll')

  // filter chip rows wrap; the page never scrolls sideways
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const row of ['Spell level', 'School']) {
    const box = await page.getByLabel(row, { exact: true }).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(box.scroll).toBeLessThanOrEqual(box.client)
  }

  // prohibited schools never appear: no spells, no school chip
  await page.getByPlaceholder('Search names and text').fill('Sleep')
  await expect(page.getByRole('button', { name: /^Sleep/ })).toHaveCount(0)
  await expect(page.getByLabel('School', { exact: true }).getByRole('button', { name: 'Ench' })).toHaveCount(0)
  await expect(page.getByLabel('School', { exact: true }).getByRole('button', { name: 'Illus' })).toHaveCount(0)

  // above the castable level: no Add button, just the level shown
  await page.getByPlaceholder('Search names and text').fill('Cone of Cold')
  await expect(page.getByRole('button', { name: /^Cone of Cold/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Cone of Cold', exact: true })).toHaveCount(0)

  // scribing cost is fixed: shown, not editable. The scroll's price is editable and starts at the standard price.
  await page.getByPlaceholder('Search names and text').fill('Web')
  await page.getByRole('button', { name: 'Add Web', exact: true }).click()
  await page.getByLabel('From a scroll').check()
  await expect(page.getByRole('dialog')).toContainText('Scribing cost: 200 gp')
  await expect(page.getByLabel('Cost to learn (gp)')).toHaveCount(0)
  await expect(page.getByLabel('Extra cost (gp)')).toHaveCount(0)
  const price = page.getByLabel('What the scroll cost (gp)')
  await expect(price).toHaveValue('150')
  await expect(page.getByRole('button', { name: /^Add to book · 350 gp/ })).toBeVisible()
  await price.fill('0') // found it
  await page.getByRole('button', { name: /^Add to book · 200 gp/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Web added' })).toBeVisible()

  // Haste: 300 scribing + 375 scroll; Web: 200 scribing + found scroll
  await page.getByRole('link', { name: 'Book' }).click()
  await expect(page.locator('header')).toContainText('875 gp spent')
  noErrors()
})

test('prepare, cast with undo, rest', async ({ page }) => {
  const noErrors = failOnErrors(page)
  await createEvoker(page)
  await learn(page, 'Fireball')
  await page.getByRole('link', { name: 'Prepare' }).click()

  const level = (name: string) => page.locator('section', { has: page.getByRole('heading', { name, exact: true }) })
  const fill = async (lvl: string, i: number, spell: string) => {
    await level(lvl).locator('li button').nth(i).click()
    await page.getByRole('button', { name: `Prepare ${spell}`, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await fill('1st level', 0, 'Magic Missile')
  await fill('1st level', 1, 'Magic Missile')
  // specialist slot only offers Evocation spells
  await level('1st level').locator('li button').nth(4).click()
  await expect(page.getByRole('button', { name: 'Prepare Shield', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Prepare Magic Missile', exact: true }).click()
  await fill('3rd level', 0, 'Fireball')
  await expect(page.locator('header')).toContainText('4/17 slots filled')

  await page.getByRole('link', { name: 'Today' }).click()
  const mm = page.getByRole('button', { name: /^Cast Magic Missile/ })
  await mm.click()
  await expect(mm).toHaveAttribute('aria-label', 'Cast Magic Missile, 2 left')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(mm).toHaveAttribute('aria-label', 'Cast Magic Missile, 3 left')
  await mm.click()
  await expect(page.locator('header')).toContainText('3 of 4 spells left')

  await page.getByRole('button', { name: 'Rest', exact: true }).click()
  await page.getByRole('button', { name: 'Rest & prepare' }).click()
  await expect(page.locator('header')).toContainText('4 of 4 spells left')
  noErrors()
})

test('ledger totals and backup round trip', async ({ page }) => {
  autoConfirm(page)
  const noErrors = failOnErrors(page)
  await createEvoker(page)
  await learn(page, 'Haste', 'From a scroll')
  await learn(page, 'Web', "From another wizard's book")
  await page.getByRole('link', { name: 'Book' }).click()
  await page.getByRole('link', { name: /gp spent/ }).click()
  // Haste: 300 gp to scribe + 375 gp standard scroll price; Web: 200 gp
  await expect(page.locator('header')).toContainText('875 gp spent on the spellbook')
  await expect(page.getByText('500 gp scribing + 375 gp on scrolls')).toBeVisible()
  await expect(page.getByText('300 gp scribing + 375 gp scroll')).toBeVisible()
  await expect(page.getByText('Add an expense')).toHaveCount(0)

  await page.getByRole('link', { name: 'More' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save backup' }).click()])
  const file = test.info().outputPath('backup.json')
  await download.saveAs(file)
  await page.getByRole('button', { name: 'Delete Mialee' }).click()
  // no characters left: back to browsing, and restoring works from More
  await page.waitForURL(/#\/library/)
  await expect(page.getByRole('link', { name: 'Book' })).toHaveCount(0)
  await page.getByRole('link', { name: 'More' }).click()
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByText('Backup restored.')).toBeVisible()
  await page.getByRole('link', { name: 'Book' }).click()
  await expect(page.locator('header')).toContainText('Mialee')
  await expect(page.locator('header')).toContainText('875 gp spent')
  noErrors()
})

test('browsing without a character: every class list, no book tabs', async ({ page }) => {
  const noErrors = failOnErrors(page)
  await page.goto('./')
  await page.waitForURL(/#\/library/)
  for (const tab of ['Book', 'Prepare', 'Today']) await expect(page.getByRole('link', { name: tab })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'More' })).toBeVisible()
  // a tab that needs a character sends you back to the Library
  await page.goto('./#/today')
  await page.waitForURL(/#\/library/)

  const search = page.getByPlaceholder('Search names and text')
  const lists = page.getByLabel('Class list', { exact: true })
  await search.fill('Cure Light Wounds')
  await expect(page.getByRole('button', { name: /^Cure Light Wounds Conj/ })).toBeVisible()
  await lists.getByRole('button', { name: 'Sor/Wiz' }).click()
  await expect(page.getByRole('button', { name: /^Cure Light Wounds Conj/ })).toHaveCount(0)
  await lists.getByRole('button', { name: 'Cleric' }).click()
  await page.getByRole('button', { name: /^Cure Light Wounds Conj/ }).click()
  await expect(page.getByText('Brd 1, Clr 1, Drd 1, Pal 1, Rgr 2, Healing 1')).toBeVisible()
  // no adding without a character
  await expect(page.getByRole('button', { name: 'Add Cure Light Wounds', exact: true })).toHaveCount(0)
  noErrors()
})

test('candlelight theme can be chosen and is remembered', async ({ page }) => {
  await createEvoker(page)
  await page.getByRole('link', { name: 'More' }).click()
  await page.getByLabel('Theme').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(23, 18, 13)')
})

test('works offline after the first visit', async ({ page, context, browserName }) => {
  // Playwright's WebKit can't reload a page while emulating offline ("WebKit encountered an
  // internal error"). This is a limit of the test browser, not Safari; check offline on Chromium.
  test.skip(browserName === 'webkit', 'offline reload is not supported in Playwright WebKit')
  await createEvoker(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // the service worker controls the page after a reload
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('link', { name: 'Library' }).click()
  await page.getByPlaceholder('Search names and text').fill('Fireball')
  await expect(page.getByRole('button', { name: /^Fireball/ })).toBeVisible()
  await context.setOffline(false)
})
