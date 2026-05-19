import { expect, test } from '@playwright/test'

test.describe('Card Create (/study/create)', () => {
  test('page renders with form fields', async ({ page }) => {
    await page.goto('/study/create')

    // Wait for the form to load (not just loading spinner)
    await expect(page.locator('h1')).toContainText('Create Card', { timeout: 10_000 })

    // Check required fields exist
    await expect(page.locator('#cc-front')).toBeVisible()
    await expect(page.locator('#cc-back')).toBeVisible()
    await expect(page.locator('#cc-reading')).toBeVisible()
  })

  test('shows validation error if front is empty', async ({ page }) => {
    await page.goto('/study/create')
    await expect(page.locator('h1')).toContainText('Create Card', { timeout: 10_000 })

    // Try submitting without filling front — HTML5 required should prevent submission
    const frontInput = page.locator('#cc-front')
    await expect(frontInput).toHaveAttribute('required')
  })

  test('creates a card and shows success toast', async ({ page }) => {
    await page.goto('/study/create')
    await expect(page.locator('h1')).toContainText('Create Card', { timeout: 10_000 })

    // Fill in the form
    await page.locator('#cc-front').fill('テスト')
    await page.locator('#cc-back').fill('test')

    // Submit
    await page.locator('button[type="submit"]').click()

    // Expect toast "Card created"
    await expect(page.locator('body')).toContainText('Card created', { timeout: 8_000 })

    // Form should reset (front field empty again)
    await expect(page.locator('#cc-front')).toHaveValue('')
  })

  test('navigates to browser from Browse Cards button', async ({ page }) => {
    await page.goto('/study/create')
    await expect(page.locator('h1')).toContainText('Create Card', { timeout: 10_000 })

    // Click Browse Cards button
    await page.locator('text=Browse Cards').click()
    await expect(page).toHaveURL(/\/study\/browser/)
  })
})
