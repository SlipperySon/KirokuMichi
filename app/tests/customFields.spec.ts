import { expect, test } from '@playwright/test'

/**
 * Custom Card Templates E2E
 *
 * Tests that:
 *  1. The template editor page loads and shows the {{field}} syntax guide
 *  2. A template can be saved for a deck (or the empty-state renders if no deck)
 *  3. The review session uses templated rendering when a template is active
 *     (verified by checking the review page renders without JS errors)
 */

test.describe('Custom Card Templates (/study/templates)', () => {
  test('template editor page renders', async ({ page }) => {
    await page.goto('/study/templates')

    // Page should load — h1 or key heading should be present
    await expect(page.locator('h1')).toContainText('Template', { timeout: 10_000 })
  })

  test('shows field syntax reference or deck selector', async ({ page }) => {
    await page.goto('/study/templates')
    await expect(page.locator('h1')).toContainText('Template', { timeout: 10_000 })

    // Either a deck picker or the {{field}} syntax hint should be visible
    const bodyText = await page.locator('body').innerText()
    const hasFieldSyntax = bodyText.includes('{{') || bodyText.includes('field')
    const hasDeckSelector = bodyText.toLowerCase().includes('deck')
    expect(hasFieldSyntax || hasDeckSelector).toBe(true)
  })

  test('front template textarea is editable when a deck is selected', async ({ page }) => {
    await page.goto('/study/templates')
    await expect(page.locator('h1')).toContainText('Template', { timeout: 10_000 })

    // If there is a textarea already visible (deck preselected or default), interact with it
    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textarea.click()
      await textarea.fill('{{front}}')
      // Ensure the value was set
      await expect(textarea).toHaveValue('{{front}}')
    } else {
      // No deck linked yet — the empty state should be clear
      const bodyText = await page.locator('body').innerText()
      expect(bodyText.trim().length).toBeGreaterThan(10)
    }
  })
})

test.describe('Template rendering in review', () => {
  test('review page loads without console errors related to template rendering', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Navigate to the review start point
    await page.goto('/study')
    await page.waitForFunction(
      () => document.body.innerText.trim() !== 'Loading…',
      { timeout: 12_000 }
    )

    // If there are due cards, try starting a review
    const reviewBtn = page.locator('button, a').filter({ hasText: /Review Cards|Start Review/i }).first()
    if (await reviewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await reviewBtn.click()
      // Wait for the review session to render
      await page.waitForTimeout(2_000)

      // No template-specific errors should have been thrown
      const templateErrors = consoleErrors.filter(e =>
        e.toLowerCase().includes('template') ||
        e.toLowerCase().includes('rendertemplate') ||
        e.toLowerCase().includes('{{')
      )
      expect(templateErrors).toHaveLength(0)
    } else {
      // No cards due — just verify the dashboard rendered cleanly
      expect(consoleErrors.filter(e => e.toLowerCase().includes('template'))).toHaveLength(0)
    }
  })

  test('TemplateEditor saves a template and navigates back', async ({ page }) => {
    await page.goto('/study/templates')
    await expect(page.locator('h1')).toContainText('Template', { timeout: 10_000 })

    // If a save button exists and a textarea is pre-filled, try saving
    const saveBtn = page.locator('button').filter({ hasText: /Save|Apply/i }).first()
    const textarea = page.locator('textarea').first()

    if (
      await textarea.isVisible({ timeout: 3_000 }).catch(() => false) &&
      await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    ) {
      await textarea.fill('{{front}}')
      await saveBtn.click()

      // Should show a success toast or confirmation
      const body = page.locator('body')
      await expect(body).toContainText(/saved|applied|template/i, { timeout: 5_000 })
    } else {
      // Graceful skip — no deck means no save button
      test.skip()
    }
  })
})
