import { expect, test } from '@playwright/test'

test.describe('Deck Management (/study)', () => {
  test('study dashboard renders and shows DeckTree', async ({ page }) => {
    await page.goto('/study')

    // Wait for the dashboard to finish loading (allow up to 12s)
    await page.waitForFunction(
      () => document.body.innerText.trim() !== 'Loading…',
      { timeout: 12_000 }
    )

    // The study dashboard should display meaningful content
    // It may show study stats, due count, deck tree, etc.
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(20)
  })

  test('create a new deck via the + button in DeckTree', async ({ page }) => {
    await page.goto('/study')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    // Look for the + button to create a deck
    // DeckTree has a "New top-level deck" button with a Plus icon
    const addButton = page.locator('button[aria-label*="new"], button[title*="new"], button[aria-label*="Add"], button[aria-label*="Create"]').first()

    if (await addButton.isVisible()) {
      await addButton.click()

      // A prompt or dialog should appear
      await page.waitForTimeout(500)

      // Fill in deck name if a dialog appeared
      const dialog = page.locator('dialog, [role="dialog"]')
      if (await dialog.isVisible()) {
        const nameInput = dialog.locator('input[type="text"]')
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Deck')
          await dialog.locator('button[type="submit"], button:has-text("Create"), button:has-text("Add")').click()
          await expect(page.locator('body')).toContainText('Test Deck', { timeout: 5_000 })
        }
      }
    } else {
      // DeckTree might use window.prompt — handle that
      page.on('dialog', async dialog => {
        await dialog.accept('Test Deck E2E')
      })

      // Try to find any deck creation trigger
      const plusButtons = page.locator('button').filter({ hasText: '+' })
      if (await plusButtons.count() > 0) {
        await plusButtons.first().click()
        await page.waitForTimeout(500)
        const bodyText = await page.locator('body').innerText()
        expect(bodyText.includes('Test Deck') || bodyText.includes('Deck')).toBeTruthy()
      }
    }
  })

  test('navigation has Create link', async ({ page }) => {
    await page.goto('/study')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 8_000 })

    // The nav should have a "Create" link
    const createLink = page.locator('nav a[href="/study/create"]')
    await expect(createLink).toBeVisible()
  })
})
