import { expect, type Page } from '@playwright/test'

/** Accept confirm() dialogs automatically. */
export function autoConfirm(page: Page) {
  page.on('dialog', (d) => d.accept())
}

/** Fails the test on uncaught page errors. */
export function failOnErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return () => expect(errors).toEqual([])
}

/** 5th-level Evoker, Int 18, prohibiting Enchantment and Illusion. */
export async function createEvoker(page: Page, starting = ['Magic Missile', 'Shield']) {
  await page.goto('./')
  await page.getByPlaceholder('e.g. Mialee').fill('Mialee')
  await page.getByRole('button', { name: 'Increase Wizard level' }).click({ clickCount: 4 })
  await page.getByLabel('Base Int value').fill('18')
  await page.getByLabel('Specialty').selectOption('Evocation')
  await page.getByRole('button', { name: 'Enchantment' }).click()
  await page.getByRole('button', { name: 'Illusion' }).click()
  await page.getByRole('button', { name: 'Create wizard' }).click()
  await page.waitForURL(/setup\/spells/)
  for (const n of starting) await page.getByRole('button', { name: `Choose ${n}`, exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`Add ${starting.length} spell`) }).click()
  await page.waitForURL(/#\/book/)
}

export async function learn(page: Page, name: string, how?: string, extra?: string) {
  await page.getByRole('link', { name: 'Library' }).click()
  await page.getByPlaceholder('Search names and text').fill(name)
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  if (how) await page.getByLabel(how).check()
  if (extra) await page.getByLabel('Extra cost (gp)').fill(extra)
  await page.getByRole('button', { name: /^Add to book/ }).click()
  await expect(page.getByRole('status').filter({ hasText: `${name} added` })).toBeVisible()
}
