import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSupplementalScenarioCache,
  getSupplementalScenarios,
  SUPPLEMENTAL_SCENARIO_SOURCES,
} from './supplementalScenarioService'

type MockCurriculum = {
  dialogues?: Array<{
    id: string
    lesson: string
    page: number
    title?: string
    lines?: Array<{ speaker?: string; japanese?: string; translation?: string }>
  }>
  exercises?: Array<{
    id: string
    lesson: string
    page: number
    question: string
  }>
}

function mockFetchWith(dataByKey: Record<string, MockCurriculum>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const key = Object.keys(dataByKey).find(textbookKey => url.includes(textbookKey))
    return {
      ok: true,
      json: async () => key ? dataByKey[key] : {},
    }
  }))
}

function mockFetchWithRealScenarioPacks() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/data/generated/scenarios/')) {
      const filePath = resolve(process.cwd(), url.replace(/^\//, ''))
      return {
        ok: true,
        json: async () => JSON.parse(readFileSync(filePath, 'utf8')),
      }
    }

    return {
      ok: true,
      json: async () => ({}),
    }
  }))
}

describe('supplementalScenarioService', () => {
  beforeEach(() => {
    clearSupplementalScenarioCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearSupplementalScenarioCache()
  })

  it('keeps the scenario source catalog aligned to the expected level textbook sets', () => {
    const grouped = new Map<string, string[]>()
    for (const source of SUPPLEMENTAL_SCENARIO_SOURCES) {
      grouped.set(source.level, [...(grouped.get(source.level) ?? []), source.textbook])
    }

    expect(Object.fromEntries(grouped)).toEqual({
      A1: ['Genki 1 Textbook', 'Genki 1 Workbook', 'Marugoto A1'],
      A2: ['Genki 2 Textbook', 'Genki 2 Workbook', 'Marugoto A2'],
      B1: ['Quartet 1 Textbook', 'Quartet 1 Workbook', 'Marugoto B1'],
      B2: ['Quartet 2 Textbook', 'Quartet 2 Workbook', 'Tobira'],
    })
  })

  it('orders curated scenario packs by numeric lesson order inside a textbook tab', async () => {
    mockFetchWithRealScenarioPacks()

    const scenarios = await getSupplementalScenarios({ textbookKey: 'genki_2_textbook' })
    const curated = scenarios.filter(scenario => scenario.sourceKind === 'curated')
    const lessonNumbers = curated.map(scenario => Number(scenario.coreLessonId?.split('_').at(-1)))

    expect(lessonNumbers.slice(0, 8)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect(lessonNumbers.indexOf(10)).toBeGreaterThan(lessonNumbers.indexOf(9))
  })

  it('loads curated scenarios for every catalog source, including workbook tabs', async () => {
    mockFetchWithRealScenarioPacks()

    const scenarios = await getSupplementalScenarios()
    const counts = new Map<string, number>()
    for (const scenario of scenarios) {
      counts.set(scenario.textbookKey, (counts.get(scenario.textbookKey) ?? 0) + 1)
    }

    for (const source of SUPPLEMENTAL_SCENARIO_SOURCES) {
      expect(counts.get(source.textbookKey) ?? 0, source.textbookKey).toBeGreaterThan(0)
    }
  })

  it('keeps scenario core lesson links inside the app lesson ranges', async () => {
    mockFetchWithRealScenarioPacks()

    const scenarios = await getSupplementalScenarios()
    const maxLessonsByPrefix = new Map([
      ['genki_1', 12],
      ['genki_2', 11],
      ['quartet_1', 6],
      ['quartet_2', 6],
    ])

    for (const scenario of scenarios) {
      const coreLessonId = scenario.coreLessonId
      if (!coreLessonId) continue
      const prefix = [...maxLessonsByPrefix.keys()].find(key => coreLessonId.startsWith(`${key}_`))
      expect(prefix, `${scenario.id} => ${coreLessonId}`).toBeTruthy()
      const lessonNumber = Number(coreLessonId.split('_').at(-1))
      expect(lessonNumber, `${scenario.id} => ${coreLessonId}`).toBeGreaterThanOrEqual(1)
      expect(lessonNumber, `${scenario.id} => ${coreLessonId}`).toBeLessThanOrEqual(maxLessonsByPrefix.get(prefix!)!)
    }
  })

  it('normalizes curated second-volume workbook lessons to app lesson IDs', async () => {
    mockFetchWithRealScenarioPacks()

    const genkiTwoWorkbook = await getSupplementalScenarios({
      textbookKey: 'genki_2_workbook',
      coreLessonId: 'genki_2_1',
    })
    expect(genkiTwoWorkbook).toHaveLength(2)
    expect(genkiTwoWorkbook.every(scenario => scenario.lessonId === 'genki_2_13')).toBe(true)
    expect(genkiTwoWorkbook.every(scenario => scenario.coreLessonId === 'genki_2_1')).toBe(true)

    clearSupplementalScenarioCache()
    const quartetTwoWorkbook = await getSupplementalScenarios({
      textbookKey: 'quartet_2_workbook',
      coreLessonId: 'quartet_2_1',
    })
    expect(quartetTwoWorkbook).toHaveLength(2)
    expect(quartetTwoWorkbook.every(scenario => scenario.lessonId === 'quartet_2_7')).toBe(true)
    expect(quartetTwoWorkbook.every(scenario => scenario.coreLessonId === 'quartet_2_1')).toBe(true)
  })

  it('turns noisy OCR-like supplemental data into stable practice scenarios', async () => {
    mockFetchWith({
      genki_1_workbook: {
        dialogues: [
          {
            id: 'front_matter_dialogue',
            lesson: 'genki_1_workbook_1',
            page: 6,
            title: 'front matter',
            lines: [
              { speaker: 'A', japanese: 'Table of Contents 目次' },
              { speaker: 'B', japanese: 'https://example.com' },
            ],
          },
          {
            id: 'model_conversation',
            lesson: 'genki_1_workbook_3',
            page: 50,
            title: '会話モデル',
            lines: [
              { speaker: 'A', japanese: '週末は何をしましたか。', translation: 'What did you do on the weekend?' },
              { speaker: 'B', japanese: '友だちと映画を見ました。', translation: 'I watched a movie with a friend.' },
              { speaker: 'A', japanese: 'どんな映画でしたか。', translation: 'What kind of movie was it?' },
              { speaker: 'B', japanese: 'とてもおもしろかったです。', translation: 'It was very interesting.' },
            ],
          },
        ],
        exercises: [
          {
            id: 'front_matter_prompt',
            lesson: 'genki_1_workbook_1',
            page: 6,
            question: 'Table of contents 目次 publication download https://example.com',
          },
          {
            id: 'drill_only',
            lesson: 'genki_1_workbook_3',
            page: 52,
            question: '正しいものを選びましょう。',
          },
          {
            id: 'weekend_pair',
            lesson: 'genki_1_workbook_3',
            page: 53,
            question: 'ペアで友だちに週末何をしたか聞いて、答えてください。',
          },
        ],
      },
      marugoto_a1_textbook: {
        exercises: [
          {
            id: 'family_can_do',
            lesson: 'marugoto_a1_4',
            page: 27,
            question: 'Can-do: 自分の家族を紹介しましょう。ペアで質問してください。',
          },
        ],
      },
      tobira_textbook: {
        exercises: [
          {
            id: 'using_tobira',
            lesson: 'tobira_1',
            page: 20,
            question: 'Using Tobira: main expressions and audio file downloads',
          },
          {
            id: 'discussion',
            lesson: 'tobira_4',
            page: 77,
            question: '日本の社会問題について、ペアで意見を話し合い、理由を説明してください。',
          },
        ],
      },
    })

    const scenarios = await getSupplementalScenarios()

    expect(scenarios.map(scenario => ({
      id: scenario.id,
      textbookKey: scenario.textbookKey,
      sourceKind: scenario.sourceKind,
      page: scenario.page,
      coreLessonId: scenario.coreLessonId,
      canDo: scenario.canDo,
      practicePrompts: scenario.practicePrompts.length,
    }))).toMatchInlineSnapshot(`
      [
        {
          "canDo": "Ask and answer follow-up questions naturally.",
          "coreLessonId": "genki_1_3",
          "id": "genki_1_workbook:prompt:weekend_pair",
          "page": 53,
          "practicePrompts": 2,
          "sourceKind": "practice_prompt",
          "textbookKey": "genki_1_workbook",
        },
        {
          "canDo": "Introduce yourself or someone else with relevant details.",
          "coreLessonId": "genki_1_2",
          "id": "marugoto_a1_textbook:prompt:family_can_do",
          "page": 27,
          "practicePrompts": 2,
          "sourceKind": "practice_prompt",
          "textbookKey": "marugoto_a1_textbook",
        },
        {
          "canDo": "Give an opinion and support it with a short reason.",
          "coreLessonId": "quartet_2_2",
          "id": "tobira_textbook:prompt:discussion",
          "page": 77,
          "practicePrompts": 2,
          "sourceKind": "practice_prompt",
          "textbookKey": "tobira_textbook",
        },
      ]
    `)

    const scenarioText = scenarios.map(scenario => scenario.sampleDialogue).join('\n')
    expect(scenarioText).not.toContain('Table of contents')
    expect(scenarioText).not.toContain('正しいもの')
    expect(scenarioText).not.toContain('Using Tobira')
  })

  it('filters by mapped core lesson and caps high-volume prompt sources', async () => {
    mockFetchWith({
      genki_1_workbook: {
        exercises: [
          ...Array.from({ length: 24 }, (_, index) => ({
            id: `pair_${index + 1}`,
            lesson: 'genki_1_workbook_3',
            page: 40 + index,
            question: `ペアで友だちに予定について質問して、理由を聞いて答えてください。${index + 1}`,
          })),
          {
            id: 'front_matter',
            lesson: 'genki_1_workbook_3',
            page: 8,
            question: 'Table of Contents 目次',
          },
        ],
      },
      marugoto_a1_textbook: {
        exercises: [
          {
            id: 'other_lesson',
            lesson: 'marugoto_a1_4',
            page: 27,
            question: 'Can-do: 自分の家族を紹介しましょう。ペアで質問してください。',
          },
        ],
      },
    })

    const scenarios = await getSupplementalScenarios({ coreLessonId: 'genki_1_3' })

    expect(scenarios).toHaveLength(18)
    expect(new Set(scenarios.map(scenario => scenario.textbookKey))).toEqual(new Set(['genki_1_workbook']))
    expect(scenarios.every(scenario => scenario.coreLessonId === 'genki_1_3')).toBe(true)
    expect(scenarios.every(scenario => scenario.page >= 35)).toBe(true)
    expect(scenarios.every(scenario => scenario.canDo && scenario.practicePrompts.length >= 2)).toBe(true)
  })

  it('maps second-volume source lesson numbers back to app lesson numbers', async () => {
    mockFetchWith({
      genki_2_workbook: {
        exercises: [
          {
            id: 'genki2_l13_roleplay',
            lesson: 'genki_2_13',
            page: 30,
            question: 'ペアでアルバイトについて質問して、答えてください。',
          },
        ],
      },
      quartet_2_workbook: {
        exercises: [
          {
            id: 'quartet2_l7_discussion',
            lesson: 'quartet_2_7',
            page: 25,
            question: '「忘れ物や落とし物をした経験」について話し合いなさい。',
          },
        ],
      },
    })

    const genkiTwo = await getSupplementalScenarios({ coreLessonId: 'genki_2_1' })
    expect(genkiTwo).toHaveLength(1)
    expect(genkiTwo[0]).toMatchObject({
      id: 'genki_2_workbook:prompt:genki2_l13_roleplay',
      coreLessonId: 'genki_2_1',
    })

    clearSupplementalScenarioCache()
    const quartetTwo = await getSupplementalScenarios({ coreLessonId: 'quartet_2_1' })
    expect(quartetTwo).toHaveLength(1)
    expect(quartetTwo[0]).toMatchObject({
      id: 'quartet_2_workbook:prompt:quartet2_l7_discussion',
      coreLessonId: 'quartet_2_1',
    })
  })

  it('rejects workbook comprehension checks and example sentences as scenario prompts', async () => {
    mockFetchWith({
      quartet_2_textbook: {
        exercises: [
          {
            id: 'example_sentence',
            lesson: 'quartet_2_7',
            page: 42,
            question: '昨日の旅行番組で紹介されていたのは、まさに私が先月行った島だった。',
          },
          {
            id: 'answer_question',
            lesson: 'quartet_2_7',
            page: 58,
            question: '会話を聞いて、質問に答えなさい。',
          },
          {
            id: 'mark_x',
            lesson: 'quartet_2_7',
            page: 58,
            question: '会話の内容に合うものに、合わないものに×をつけなさい。',
          },
          {
            id: 'broken_fragment',
            lesson: 'quartet_2_7',
            page: 59,
            question: 'う。その後、グループで話しましょう。',
          },
          {
            id: 'statement_only',
            lesson: 'quartet_2_7',
            page: 59,
            question: 'ある新聞が大学生の橋本くんの生活を紹介しています。',
          },
          {
            id: 'discussion',
            lesson: 'quartet_2_7',
            page: 78,
            question: '「忘れ物や落とし物をした経験」について話し合いなさい。',
          },
        ],
      },
    })

    const scenarios = await getSupplementalScenarios({ cefr: 'B2' })

    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]).toMatchObject({
      id: 'quartet_2_textbook:prompt:discussion',
      sourceKind: 'practice_prompt',
      page: 78,
      canDo: 'Give an opinion and support it with a short reason.',
    })
    expect(scenarios[0].sampleDialogue).toContain('忘れ物')
  })
})
