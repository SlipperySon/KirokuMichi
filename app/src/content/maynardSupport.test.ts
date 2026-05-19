import { describe, expect, it } from 'vitest'
import { buildGrammarExplanationPlan } from './maynardExplanationEngine'
import { getMaynardSupport, hasMaynardSupport } from './maynardSupport'
import type { GrammarItem } from './curriculumService'

function grammar(pattern: string): GrammarItem {
  return {
    id: pattern,
    pattern,
    meaning: 'test meaning',
    explanation: 'A short test explanation.',
    examples: [],
    lesson: 'genki_1_1',
    source: 'test',
    page: 0,
  }
}

describe('Maynard support', () => {
  it('prefers direct Maynard source refs for foundational grammar', () => {
    const item = grammar('は')
    const plan = buildGrammarExplanationPlan(item)
    const support = getMaynardSupport(item)

    expect(hasMaynardSupport(item)).toBe(true)
    expect(support?.sourceKind).toBe('direct')
    expect(support?.pageStart).toBeGreaterThan(0)
    expect(plan.maynardTitle).toContain('Essential particles')
  })

  it('does not invent deep support for unknown patterns', () => {
    const item = grammar('totally unknown pattern')
    const plan = buildGrammarExplanationPlan(item)

    expect(hasMaynardSupport(item)).toBe(false)
    expect(plan.maynardDeepExplanation).toBeUndefined()
  })

  it('adds deep support for common A2 grammar without a pre-attached Maynard ref', () => {
    const item = grammar('かどうか')
    const plan = buildGrammarExplanationPlan(item)
    const support = getMaynardSupport(item)

    expect(hasMaynardSupport(item)).toBe(true)
    expect(support?.sourceKind).toBe('direct')
    expect(plan.maynardTitle).toContain('Binary choices')
  })

  it('keeps curated support bridges when no direct source ref is available', () => {
    const b1 = buildGrammarExplanationPlan(grammar('から見ると'), [grammar('逆に')])
    const b2 = buildGrammarExplanationPlan(grammar('ざるを得ない'))

    expect(getMaynardSupport(grammar('せめて'))?.sourceKind).toBe('curated-support')
    expect(b1.maynardTitle).toContain('Further particles')
    expect(b1.contrastWithNearbyGrammar).toContain('逆に')
    expect(getMaynardSupport(grammar('ざるを得ない'))?.sourceKind).toBe('direct')
    expect(b2.commonMistake).toContain('no realistic alternative')
  })
})
