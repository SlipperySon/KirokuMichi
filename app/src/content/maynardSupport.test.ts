import { describe, expect, it } from 'vitest'
import { buildGrammarExplanationPlan } from './maynardExplanationEngine'
import { hasMaynardSupport } from './maynardSupport'
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

describe('Maynard support fallback', () => {
  it('adds deep support for foundational grammar without a pre-attached Maynard ref', () => {
    const item = grammar('は')
    const plan = buildGrammarExplanationPlan(item)

    expect(hasMaynardSupport(item)).toBe(true)
    expect(plan.maynardTitle).toContain('topic')
    expect(plan.maynardDeepExplanation).toContain('marks what the sentence is about')
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

    expect(hasMaynardSupport(item)).toBe(true)
    expect(plan.maynardTitle).toContain('yes/no question')
    expect(plan.maynardDeepExplanation).toContain('turns a yes/no question into a noun-like question')
  })

  it('adds deep support bridges for B1 and B2 discussion grammar', () => {
    const b1 = buildGrammarExplanationPlan(grammar('から見ると'), [grammar('逆に')])
    const b2 = buildGrammarExplanationPlan(grammar('ざるを得ない'))

    expect(b1.maynardTitle).toContain('viewpoint')
    expect(b1.contrastWithNearbyGrammar).toContain('逆に')
    expect(b2.maynardTitle).toContain('responsibility')
    expect(b2.commonMistake).toContain('no realistic alternative')
  })
})
