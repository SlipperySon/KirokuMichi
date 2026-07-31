import { expect, test } from '@playwright/test'

/**
 * Pre-testing UI pass: settings backup affordances, Review hub (Extra lane),
 * and gold pack health — flows closed-beta testers will hit first.
 */

test.describe('pre-testing UI pass', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('kiroku-beta-access', 'granted')
    })
  })

  test('Settings shows Backup & Restore export/restore controls', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /Backup\s*&\s*Restore/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /Export backup/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Restore backup/i })).toBeVisible()
  })

  test('Review hub renders path vs Extra Anki decks lane', async ({ page }) => {
    await page.goto('/study/srs')
    await expect(page.getByText(/Extra Anki decks/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Review path cards/i })).toBeVisible()
  })

  test('reviewed gold index is healthy for staging content', async ({ page }) => {
    const res = await page.request.get('/data/generated/reviewed/index.json')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const gold = body.summary?.gold ?? body.gold
    const draft = body.summary?.draft ?? body.draft ?? 0
    const total = body.summary?.total ?? body.total
    expect(gold).toBeGreaterThanOrEqual(100)
    expect(draft).toBe(0)
    expect(total).toBe(gold)
  })

  test('Genki I L1 lesson page opens without error chrome', async ({ page }) => {
    await page.goto('/learn/lessons/a1/1')
    await expect(page.locator('body')).not.toContainText('Checking access', { timeout: 20_000 })
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    await expect(page.getByText(/Genki|Lesson|Start|ともだち|大学/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})
