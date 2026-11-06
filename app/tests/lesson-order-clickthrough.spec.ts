import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Ordered click-through of every CEFR Course lesson page (A1→B2).
 * Asserts gold pack is served and the LessonPage renders without error chrome.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.resolve(__dirname, '../data/generated/reviewed/index.json')
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
  packs: Array<{ lessonId: string; tier: string; vocabulary: number; grammar: number; title?: string }>
}
const packById = new Map(index.packs.map((p) => [p.lessonId, p]))

const SPINE: Array<{ cefr: 'a1' | 'a2' | 'b1' | 'b2'; lessonId: string; n: number }> = [
  ...Array.from({ length: 12 }, (_, i) => ({ cefr: 'a1' as const, lessonId: `genki_1_${i + 1}`, n: i + 1 })),
  ...Array.from({ length: 11 }, (_, i) => ({ cefr: 'a2' as const, lessonId: `genki_2_${i + 1}`, n: i + 1 })),
  ...Array.from({ length: 6 }, (_, i) => ({ cefr: 'b1' as const, lessonId: `quartet_1_${i + 1}`, n: i + 1 })),
  ...Array.from({ length: 6 }, (_, i) => ({ cefr: 'b2' as const, lessonId: `quartet_2_${i + 1}`, n: i + 1 })),
]

async function seedLearner(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('kiroku-beta-access', 'granted')
    localStorage.setItem(
      'kiroku-michi-app',
      JSON.stringify({
        state: {
          onboardingComplete: true,
          settings: {
            locale: 'en',
            dailyGoal: 20,
            schedulerAlgorithm: 'fsrs',
            includeTextbookLessons: true,
          },
        },
        version: 0,
      }),
    )
  })
}

test.describe('Ordered CEFR lesson click-through', () => {
  test.beforeEach(async ({ page }) => {
    await seedLearner(page)
  })

  test('every Course spine lesson pack is gold and page loads in order', async ({ page }) => {
    test.setTimeout(240_000)
    const failures: string[] = []
    const visited: string[] = []

    for (const lesson of SPINE) {
      const meta = packById.get(lesson.lessonId)
      if (!meta || meta.tier !== 'gold') {
        failures.push(`${lesson.lessonId}: missing gold pack`)
        continue
      }
      if (meta.vocabulary < 5) failures.push(`${lesson.lessonId}: low vocab (${meta.vocabulary})`)
      if (meta.grammar < 1) failures.push(`${lesson.lessonId}: no grammar`)

      const packRes = await page.request.get(`/data/generated/reviewed/${lesson.lessonId}.json`)
      if (!packRes.ok()) {
        failures.push(`${lesson.lessonId}: pack HTTP ${packRes.status()}`)
        continue
      }
      const body = await packRes.json()
      if (!body.lessons?.[0]) {
        failures.push(`${lesson.lessonId}: pack has no lessons[0]`)
        continue
      }

      await page.goto(`/learn/lessons/${lesson.cefr}/${lesson.n}`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('body')).not.toContainText('Curriculum not found', { timeout: 20_000 })
      await expect(page.locator('body')).not.toContainText('Something went wrong', { timeout: 5_000 })

      // sql.js + curriculum fetch can leave a Loading… shell; wait it out per lesson.
      const startLesson = page.getByRole('button', { name: /Start Lesson/i })
      try {
        await expect(startLesson.first()).toBeVisible({ timeout: 45_000 })
        visited.push(`${lesson.cefr}/${lesson.n}:${lesson.lessonId}`)
      } catch {
        const snippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 240).replace(/\s+/g, ' ')
        failures.push(`${lesson.lessonId}: LessonPage incomplete @ ${page.url()} :: ${snippet}`)
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
    expect(visited.length).toBe(SPINE.length)
  })

  test('Next Lesson walks Genki I 1→12 then opens L1 rail', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/learn/lessons/a1/1')
    await expect(page.getByRole('button', { name: /Start Lesson/i }).first()).toBeVisible({ timeout: 20_000 })

    for (let n = 1; n <= 11; n += 1) {
      await expect(page).toHaveURL(new RegExp(`/learn/lessons/a1/${n}`))
      await expect(page.getByText(new RegExp(`Genki I - Lesson ${n}`, 'i')).first()).toBeVisible({
        timeout: 15_000,
      })
      await page.getByRole('button', { name: /^Next Lesson$/i }).click()
      await expect(page).toHaveURL(new RegExp(`/learn/lessons/a1/${n + 1}`), { timeout: 15_000 })
    }

    await expect(page.getByText(/Genki I - Lesson 12/i).first()).toBeVisible({ timeout: 15_000 })
    await page.goto('/learn/lessons/a1/1')
    await page.getByRole('button', { name: /Start Lesson/i }).first().click()
    await expect(page).toHaveURL(/\/learn\/study/, { timeout: 15_000 })
    await expect(page.getByText(/Intro|Teach|Check|Cards|Speak|Practice/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('Course hub lists A1–B2 shortcuts', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/learn')
    await expect(page.locator('#lesson-menu, [id^="lesson-menu-"]').first()).toBeVisible({ timeout: 25_000 })
    for (const cefr of ['a1', 'a2', 'b1', 'b2']) {
      await expect(page.locator(`#lesson-menu-${cefr}`)).toBeVisible({ timeout: 15_000 })
    }
  })
})
