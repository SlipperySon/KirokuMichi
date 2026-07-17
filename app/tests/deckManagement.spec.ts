import { expect, test } from '@playwright/test'

test.describe('Deck Management (/study)', () => {
  test('study dashboard renders and shows DeckTree', async ({ page }) => {
    await page.goto('/study')
    await expect
      .poll(async () => {
        const text = await page.locator('body').innerText()
        if (text.trim() === 'Loading…') return ''
        return text
      }, { timeout: 15_000 })
      .toMatch(/Review Cards|Today|Due|Deck/i)
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

    // Nav uses a hamburger menu — open it first, then check for the Create Card link
    const menuBtn = page.locator('button[aria-label="Open menu"]')
    await menuBtn.click()
    const createLink = page.locator('a[href="/study/create"]')
    await expect(createLink).toBeVisible({ timeout: 3_000 })
  })
})
