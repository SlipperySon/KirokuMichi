import { expect, test, type Page } from '@playwright/test'

/**
 * Phase 6 lesson-rail smoke — Cards deferral, Speak production gate, scenario practice.
 * Seeds a mid-rail localStorage snapshot so the test stays fast and deterministic.
 */

const LESSON_ID = 'smoke_rail_1'

const lessonState = {
  vocab: [
    { id: 'v1', surface: '学生', english: 'student', lesson: LESSON_ID, source: 'smoke', page: 1 },
    { id: 'v2', surface: '先生', english: 'teacher', lesson: LESSON_ID, source: 'smoke', page: 2 },
    { id: 'v3', surface: '友だち', english: 'friend', lesson: LESSON_ID, source: 'smoke', page: 3 },
    { id: 'v4', surface: '本', english: 'book', lesson: LESSON_ID, source: 'smoke', page: 4 },
  ],
  grammar: [
    { id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: LESSON_ID, source: 'smoke', page: 1 },
  ],
  lessonId: LESSON_ID,
  lessonTitle: 'Smoke Rail Lesson',
  cefrLevel: 'a1' as const,
}

/** First-session budget plan: intro → teach → checkpoint → cards → speak */
const CARDS_STEP_INDEX = 3
const SPEAK_STEP_INDEX = 4

function cardsSnapshot() {
  return {
    version: 1 as const,
    lesson: lessonState,
    stepIndex: CARDS_STEP_INDEX,
    teachIndex: 0,
    questionIndex: 0,
    answers: [],
    selfAssessments: [],
    workbookResponses: {},
    speakResponse: '',
    speakCompleted: false,
    cardsCompleted: false,
    cardsDeferred: false,
    updatedAt: new Date().toISOString(),
  }
}

function speakSnapshot(overrides: Partial<ReturnType<typeof cardsSnapshot>> = {}) {
  return {
    ...cardsSnapshot(),
    stepIndex: SPEAK_STEP_INDEX,
    cardsDeferred: true,
    ...overrides,
  }
}

async function seedLessonSession(page: Page, snapshot: ReturnType<typeof cardsSnapshot>) {
  await page.addInitScript(({ snap, lessonId }) => {
    localStorage.setItem(`kiroku-lesson-session:${lessonId}`, JSON.stringify(snap))
  }, { snap: snapshot, lessonId: LESSON_ID })
}

async function openResumedLesson(page: Page) {
  await page.goto(`/learn/study?resume=${encodeURIComponent(LESSON_ID)}`)
  await expect(page.locator('body')).not.toContainText('Loading lesson', { timeout: 20_000 })
}

test.describe('lesson rail Phase 6 smoke', () => {
  test('queues Cards on Today then requires Japanese Speak output to finish', async ({ page }) => {
    await seedLessonSession(page, cardsSnapshot())
    await openResumedLesson(page)

    await expect(page.getByRole('heading', { name: 'Review lesson cards' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Queue on Today/i })).toBeVisible()

    await page.getByRole('button', { name: /Queue on Today/i }).click()
    await expect(page.getByRole('heading', { name: 'Produce before you finish' })).toBeVisible({ timeout: 15_000 })

    const finish = page.getByRole('button', { name: 'Mark lesson complete' })
    await expect(finish).toBeDisabled()

    // Romaji alone must not unlock completion
    await page.getByPlaceholder('Type your sentence here…').fill('watashi wa gakusei desu')
    await expect(finish).toBeDisabled()

    // Valid Japanese with lesson target
    await page.getByPlaceholder('Type your sentence here…').fill('わたしは学生です')
    await expect(finish).toBeEnabled()
    await finish.click()
    await expect(page.getByText('Lesson complete')).toBeVisible({ timeout: 10_000 })
  })

  test('scenario Live Practice can satisfy Speak without typing on the rail', async ({ page }) => {
    await page.addInitScript(({ snap, lessonId }) => {
      localStorage.setItem(`kiroku-lesson-session:${lessonId}`, JSON.stringify(snap))
      localStorage.setItem(`kiroku-scenario-practice:${lessonId}`, new Date().toISOString())
    }, { snap: speakSnapshot(), lessonId: LESSON_ID })

    await openResumedLesson(page)
    await expect(page.getByRole('heading', { name: 'Produce before you finish' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Scenario Live Practice recorded/i)).toBeVisible()

    const finish = page.getByRole('button', { name: 'Mark lesson complete' })
    await expect(finish).toBeEnabled()
    await finish.click()
    await expect(page.getByText('Lesson complete')).toBeVisible({ timeout: 10_000 })
  })

  test('intro rail shows science progress phases', async ({ page }) => {
    await seedLessonSession(page, { ...cardsSnapshot(), stepIndex: 0 })
    await openResumedLesson(page)

    await expect(page.getByText('Encode → check → practice → cards → speak')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('navigation', { name: 'Lesson progress' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Lesson progress' })).toContainText('Intro')
    await expect(page.getByRole('navigation', { name: 'Lesson progress' })).toContainText('Cards')
    await expect(page.getByRole('navigation', { name: 'Lesson progress' })).toContainText('Speak')
    await expect(page.getByRole('button', { name: 'Start teaching' })).toBeVisible()
  })
})
