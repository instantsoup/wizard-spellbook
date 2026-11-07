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

test('library: free pick, paid spell with extra cost, prohibited and above-level spells, fixed cost', async ({ page }) => {
  const noErrors = failOnErrors(page)
  await createEvoker(page)
  await learn(page, 'Fireball') // level-5 free pick by default
  await learn(page, 'Haste', 'From a scroll', '375')

  await page.getByPlaceholder('Search names and text').fill('Sleep')
  await expect(page.getByRole('button', { name: 'Add Sleep', exact: true })).toHaveCount(0)

  // above the castable level: no Add button, just the level shown
  await page.getByPlaceholder('Search names and text').fill('Cone of Cold')
  await expect(page.getByRole('button', { name: /^Cone of Cold/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Cone of Cold', exact: true })).toHaveCount(0)

  // learning cost is fixed: shown, not editable
  await page.getByPlaceholder('Search names and text').fill('Web')
  await page.getByRole('button', { name: 'Add Web', exact: true }).click()
  await page.getByLabel('From a scroll').check()
  await expect(page.getByRole('dialog')).toContainText('200 gp')
  await expect(page.getByLabel('Cost to learn (gp)')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click()

  await page.getByRole('link', { name: 'Book' }).click()
  await expect(page.locator('header')).toContainText('675 gp spent')
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
  await learn(page, 'Haste', 'From a scroll', '375')
  await page.getByRole('link', { name: 'Book' }).click()
  await page.getByRole('link', { name: /gp spent/ }).click()
  await page.getByPlaceholder('e.g. Rare incense, new spellbook').fill('Sold a scroll')
  await page.getByPlaceholder('0').fill('-100')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('header')).toContainText('575 gp spent in total')

  await page.getByRole('link', { name: 'More' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save backup' }).click()])
  const file = test.info().outputPath('backup.json')
  await download.saveAs(file)
  await page.getByRole('button', { name: 'Delete Mialee' }).click()
  await page.waitForURL(/#\/setup/)
  await page.getByPlaceholder('e.g. Mialee').fill('Temp')
  await page.getByRole('button', { name: 'Create wizard' }).click()
  await page.waitForURL(/setup\/spells/)
  await page.goto('./#/more')
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByText('Backup restored.')).toBeVisible()
  await page.getByRole('link', { name: 'Book' }).click()
  await expect(page.locator('header')).toContainText('Mialee')
  await expect(page.locator('header')).toContainText('575 gp spent')
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

test('works offline after the first visit', async ({ page, context }) => {
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
