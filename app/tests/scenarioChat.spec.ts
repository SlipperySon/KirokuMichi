import { expect, test } from '@playwright/test'

/**
 * Scenario Chat E2E tests.
 *
 * These keep CI deterministic by testing the live-chat shell without sending a
 * message to an external AI provider.
 */

test.describe('ScenarioMode (/scenarios)', () => {
  test('scenarios page renders', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    // The page should render some scenario content or empty state
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(10)
  })

  test('page title or heading is visible', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    // Should have some recognisable text
    const bodyText = await page.locator('body').innerText()
    expect(
      bodyText.includes('Scenario') || bodyText.includes('Practice') || bodyText.includes('scenario')
    ).toBeTruthy()
  })

  test('can open a scenario and start the live chat shell', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    await page.getByTestId('scenario-card').first().click()

    const practiceButton = page.getByRole('button', { name: 'Practice Live' })
    await expect(practiceButton).toBeVisible({ timeout: 5_000 })
    await practiceButton.click()

    const chatInput = page.getByTestId('scenario-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 8_000 })
    await chatInput.fill('こんにちは')
    await expect(chatInput).toHaveValue('こんにちは')
  })
})
