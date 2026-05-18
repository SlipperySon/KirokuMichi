import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const SCREENSHOT_DIR = path.resolve('tools/qa/out/route-screenshots')

const ROUTES = [
  { path: '/study', expectText: 'Today' },
  { path: '/learn', expectText: 'Study by Lesson' },
  { path: '/learn/lessons', expectText: 'Study by Lesson' },
  { path: '/learn/lessons/a1/1', expectText: 'Start Lesson' },
  { path: '/scenarios?level=A1&source=genki_1_workbook', expectText: 'Genki 1 Workbook' },
  { path: '/practice', expectText: 'AI Tutor' },
  { path: '/study/grammar', expectText: 'Grammar Review' },
  { path: '/study/mistakes', expectText: 'Mistake Review' },
]

async function waitForAppReady(pageText: () => Promise<string>, expected: string) {
  await expect
    .poll(async () => {
      const text = await pageText()
      if (text.trim() === 'Loading…') return ''
      return text
    })
    .toContain(expected)
}

test.describe('critical route smoke', () => {
  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  for (const route of ROUTES) {
    test(`${route.path} renders, fits viewport, and captures screenshot`, async ({ page }, testInfo) => {
      await page.goto(route.path)
      await waitForAppReady(() => page.locator('body').innerText(), route.expectText)

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(overflow.scrollWidth, `${route.path} should not horizontally overflow`).toBeLessThanOrEqual(
        overflow.clientWidth + 2
      )

      const routeSlug = route.path
        .replace(/^\//, '')
        .replace(/[/?=&:]+/g, '-')
        .replace(/-$/, '') || 'root'
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${testInfo.project.name}-${routeSlug}.png`),
        fullPage: false,
      })
    })
  }
})
