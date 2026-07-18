import { describe, expect, it } from 'vitest'
import { buildLessonPlan } from './lessonStudyPlanner'
import { railPhaseFromStepKind } from './lessonSessionPersistence'

describe('buildLessonPlan', () => {
  it('wraps teach content with intro → cards → speak rail ends', () => {
    const plan = buildLessonPlan(
      [
        {
          id: 'late',
          surface: 'おねえさん',
          english: 'older sister',
          lesson: 'genki_1_1',
          source: 'genki_1_textbook',
          page: 32,
        },
        {
          id: 'early',
          surface: 'すうじ',
          english: 'numbers',
          lesson: 'genki_1_1',
          source: 'genki_1_textbook',
          page: 10,
        },
      ],
      [
        {
          id: 'desu',
          pattern: 'です',
          meaning: 'polite to be',
          lesson: 'genki_1_1',
          source: 'genki_1_textbook',
          page: 34,
        },
      ],
      'genki_1_1'
    )

    expect(plan[0]?.kind).toBe('intro')
    expect(plan.at(-2)?.kind).toBe('cards')
    expect(plan.at(-1)?.kind).toBe('speak')

    const firstTeachStep = plan.find(step => step.kind === 'teach')
    expect(firstTeachStep?.kind).toBe('teach')
    if (firstTeachStep?.kind !== 'teach') return

    // Vocab is sorted by extracted page (すうじ p10, おねえさん p32).
    // Grammar (です) is interleaved after the first vocab item (ratio=0.5 → target=1 after item 0).
    expect(firstTeachStep.items.map(item => item.title)).toEqual([
      'すうじ',     // p10, earliest vocab page
      'です',       // grammar interleaved after vocab[0]
      'おねえさん', // p32
    ])
  })

  it('interleaves multiple grammar items evenly across vocab', () => {
    const vocab = [
      { id: 'v1', surface: 'A', english: 'a', lesson: 'l1', source: 'src', page: 10 },
      { id: 'v2', surface: 'B', english: 'b', lesson: 'l1', source: 'src', page: 20 },
      { id: 'v3', surface: 'C', english: 'c', lesson: 'l1', source: 'src', page: 30 },
    ]
    const grammar = [
      { id: 'g1', pattern: 'G1', meaning: 'm1', lesson: 'l1', source: 'test_textbook', page: 0 },
      { id: 'g2', pattern: 'G2', meaning: 'm2', lesson: 'l1', source: 'test_textbook', page: 0 },
      { id: 'g3', pattern: 'G3', meaning: 'm3', lesson: 'l1', source: 'test_textbook', page: 0 },
      { id: 'g4', pattern: 'G4', meaning: 'm4', lesson: 'l1', source: 'test_textbook', page: 0 },
      { id: 'g5', pattern: 'G5', meaning: 'm5', lesson: 'l1', source: 'test_textbook', page: 0 },
    ]
    const plan = buildLessonPlan(vocab, grammar, 'l1')
    const allTeachItems = plan.filter(s => s.kind === 'teach').flatMap(s => s.kind === 'teach' ? s.items : [])
    const titles = allTeachItems.map(i => i.title)
    // Grammar must be spread throughout, not all clumped at the end
    const lastVocabIdx = Math.max(titles.indexOf('A'), titles.indexOf('B'), titles.indexOf('C'))
    const firstGrammarIdx = Math.min(titles.indexOf('G1'), titles.indexOf('G2'), titles.indexOf('G3'), titles.indexOf('G4'), titles.indexOf('G5'))
    // At least one grammar item appears before the last vocab item
    expect(firstGrammarIdx).toBeLessThan(lastVocabIdx)
  })

  it('places workbook practice before cards and speak', () => {
    const plan = buildLessonPlan(
      [
        { id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 32 },
        { id: 'v2', surface: '先生', english: 'teacher', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 33 },
        { id: 'v3', surface: '大学', english: 'university', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 34 },
      ],
      [
        { id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 34 },
        { id: 'g2', pattern: 'は', meaning: 'topic marker', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 35 },
        { id: 'g3', pattern: 'か', meaning: 'question marker', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 36 },
      ],
      'genki_1_1',
      [
        {
          id: 'workbook:1',
          source: 'Genki 1 Workbook',
          sourceKey: 'genki_1_workbook',
          page: 12,
          type: 'roleplay',
          practiceMode: 'output',
          focus: 'spoken output',
          prompt: 'Introduce yourself and ask one follow-up question.',
          support: 'Answer once as yourself, then switch roles.',
        },
      ]
    )

    const kinds = plan.map(step => step.kind)
    expect(kinds[0]).toBe('intro')
    expect(kinds).toContain('workbook')
    expect(kinds.indexOf('workbook')).toBeLessThan(kinds.indexOf('cards'))
    expect(kinds.indexOf('cards')).toBeLessThan(kinds.indexOf('speak'))
    expect(kinds.at(-1)).toBe('speak')

    const workbookStep = plan.find(step => step.kind === 'workbook')
    expect(workbookStep?.kind).toBe('workbook')
    if (workbookStep?.kind !== 'workbook') return
    expect(workbookStep.tasks).toHaveLength(1)
    expect(workbookStep.tasks[0].prompt).toContain('Introduce yourself')
  })

  it('injects typed recall into final mixed review', () => {
    const plan = buildLessonPlan(
      [
        { id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 32 },
        { id: 'v2', surface: '先生', english: 'teacher', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 33 },
        { id: 'v3', surface: '大学', english: 'university', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 34 },
        { id: 'v4', surface: '本', english: 'book', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 35 },
      ],
      [
        { id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 34 },
        { id: 'g2', pattern: 'は', meaning: 'topic marker', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 35 },
        { id: 'g3', pattern: 'か', meaning: 'question marker', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 36 },
      ],
      'genki_1_1',
    )
    const final = plan.find(step => step.kind === 'final')
    expect(final?.kind).toBe('final')
    if (final?.kind !== 'final') return
    expect(final.questions.some(q => q.recallMode === 'typed')).toBe(true)
    expect(final.questions[0]?.recallMode).toBe('typed')
  })

  it('maps step kinds onto the six-phase progress rail', () => {
    expect(railPhaseFromStepKind('intro')).toBe('intro')
    expect(railPhaseFromStepKind('teach')).toBe('teach')
    expect(railPhaseFromStepKind('checkpoint')).toBe('check')
    expect(railPhaseFromStepKind('final')).toBe('check')
    expect(railPhaseFromStepKind('workbook')).toBe('practice')
    expect(railPhaseFromStepKind('cards')).toBe('cards')
    expect(railPhaseFromStepKind('speak')).toBe('speak')
  })
})
