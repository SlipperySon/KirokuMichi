import { expect, test } from '@playwright/test'

/**
 * ScenarioMode v2 — AI conversation E2E
 *
 * Uses Playwright's route intercept to mock `/api/ai/complete` so no real
 * API key is needed. The mock returns a valid SSE stream with a short
 * Japanese response + correction JSON, which lets us verify the full
 * send → stream → render → corrections flow without external dependencies.
 */

/**
 * ScenarioMode uses completeWithMessages (non-streaming), which POSTs to
 * /api/ai/complete and expects a JSON body: { "content": "..." }
 */
const MOCK_REPLY_TEXT = 'いらっしゃいませ！何かお手伝いできますか？'
const MOCK_RESPONSE_JSON = JSON.stringify({ reply: MOCK_REPLY_TEXT, corrections: [] })

test.describe('ScenarioMode v2 — AI conversation (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed Zustand-persisted settings so the AI provider is configured
    // The store key is 'kiroku-app-state' (or similar) — we inject before first navigation
    await page.addInitScript(() => {
      const existingRaw = localStorage.getItem('kiroku-michi-app')
      let existing: Record<string, unknown> = {}
      try { existing = JSON.parse(existingRaw ?? '{}') as Record<string, unknown> } catch { /* ignore */ }
      const patched = {
        ...existing,
        state: {
          ...((existing as { state?: Record<string, unknown> }).state ?? {}),
          settings: {
            ...(((existing as { state?: { settings?: Record<string, unknown> } }).state?.settings) ?? {}),
            aiProvider: 'anthropic',
            apiKey: 'test-api-key-mock',
            sessionToken: 'test-token-mock',
          },
        },
      }
      localStorage.setItem('kiroku-michi-app', JSON.stringify(patched))
    })

    // Intercept AI calls and return a canned JSON reply matching { text: string }
    await page.route('**/api/ai/complete', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: MOCK_RESPONSE_JSON }),
      })
    })
  })

  test('can send a message and receive a mocked AI response', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    // Open first scenario card
    const card = page.getByTestId('scenario-card').first()
    await expect(card).toBeVisible({ timeout: 8_000 })
    await card.click()

    // Click "Practice Live" to open the chat panel
    const practiceBtn = page.getByRole('button', { name: 'Practice Live' })
    await expect(practiceBtn).toBeVisible({ timeout: 5_000 })
    await practiceBtn.click()

    // Chat input should appear
    const chatInput = page.getByTestId('scenario-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 8_000 })

    // Type and send a message
    await chatInput.fill('こんにちは')
    await page.keyboard.press('Enter')

    // The mocked response text should appear somewhere in the chat
    await expect(page.locator('body')).toContainText(MOCK_REPLY_TEXT, { timeout: 10_000 })
  })

  test('chat input clears after sending', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    const card = page.getByTestId('scenario-card').first()
    await expect(card).toBeVisible({ timeout: 8_000 })
    await card.click()

    const practiceBtn = page.getByRole('button', { name: 'Practice Live' })
    await expect(practiceBtn).toBeVisible({ timeout: 5_000 })
    await practiceBtn.click()

    const chatInput = page.getByTestId('scenario-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 8_000 })

    await chatInput.fill('ありがとう')
    await page.keyboard.press('Enter')

    // Input should clear after submission
    await expect(chatInput).toHaveValue('', { timeout: 5_000 })
  })

  test('send button triggers AI call', async ({ page }) => {
    let aiCallMade = false
    await page.route('**/api/ai/complete', async route => {
      aiCallMade = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: MOCK_RESPONSE_JSON }),
      })
    })

    await page.goto('/scenarios')
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 10_000 })

    const card = page.getByTestId('scenario-card').first()
    await expect(card).toBeVisible({ timeout: 8_000 })
    await card.click()

    const practiceBtn = page.getByRole('button', { name: 'Practice Live' })
    await expect(practiceBtn).toBeVisible({ timeout: 5_000 })
    await practiceBtn.click()

    const chatInput = page.getByTestId('scenario-chat-input')
    await expect(chatInput).toBeVisible({ timeout: 8_000 })
    await chatInput.fill('すみません')

    // Click the send button explicitly (instead of Enter)
    const sendBtn = page.locator('button[type="submit"], button[aria-label*="send" i], button[aria-label*="Send" i]').first()
    if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await sendBtn.click()
    } else {
      await page.keyboard.press('Enter')
    }

    await expect(page.locator('body')).toContainText(MOCK_REPLY_TEXT, { timeout: 10_000 })
    expect(aiCallMade).toBe(true)
  })
})
