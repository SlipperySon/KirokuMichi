import { expect, test } from '@playwright/test'

test.describe('Card Browser (/study/browser)', () => {
  test('renders the table with column headers', async ({ page }) => {
    await page.goto('/study/browser')

    await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })

    // Wait for loading to complete
    await expect(page.locator('body')).not.toContainText('Loading…', { timeout: 8_000 })

    // The page should have the search bar and at least one filter UI element
    await expect(page.locator('input[type="search"]')).toBeVisible()

    // Body should contain 'Front' (column header button) or 'No cards match'
    const bodyText = await page.locator('body').innerText()
    expect(
      bodyText.includes('Front') || bodyText.includes('front') || bodyText.includes('No cards')
    ).toBeTruthy()
  })

  test('search filter input is present', async ({ page }) => {
    await page.goto('/study/browser')
    await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()
  })

  test('typing in search filter updates visible text', async ({ page }) => {
    await page.goto('/study/browser')
    await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })

    // Find the search input and type
    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('あいうえお')

    // Wait a moment for filter to apply
    await page.waitForTimeout(300)

    // Either no cards match or the filtered text appears
    const bodyText = await page.locator('body').innerText()
    expect(
      bodyText.includes('No cards match') || bodyText.includes('あいうえお') || bodyText.includes('0 cards')
    ).toBeTruthy()
  })

  test('deck filter dropdown is present', async ({ page }) => {
    await page.goto('/study/browser')
    await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })

    // The deck filter select
    const deckSelect = page.locator('select').first()
    await expect(deckSelect).toBeVisible()
  })

  test('clicking a row opens the preview pane', async ({ page }) => {
    await page.goto('/study/browser')
    await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })

    // Check if there are any rows in the table
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    if (rowCount === 0) {
      // No cards yet — create one first
      await page.goto('/study/create')
      await expect(page.locator('h1')).toContainText('Create Card', { timeout: 10_000 })
      await page.locator('#cc-front').fill('ブラウザテスト')
      await page.locator('#cc-back').fill('browser test')
      await page.locator('button[type="submit"]').click()
      await expect(page.locator('body')).toContainText('Card created', { timeout: 8_000 })

      // Go back to browser
      await page.goto('/study/browser')
      await expect(page.locator('h1')).toContainText('Card Browser', { timeout: 10_000 })
    }

    // Click the first row
    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()

    // Preview pane should appear with "Card detail"
    await expect(page.locator('text=Card detail')).toBeVisible({ timeout: 5_000 })
  })
})
