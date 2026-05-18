import { describe, expect, it } from 'vitest'
import { buildCustomConversationSystemPrompt } from './systemPrompts'

describe('conversation system prompts', () => {
  it('builds an open custom conversation prompt when no setup is provided', () => {
    const prompt = buildCustomConversationSystemPrompt('', 'a2')

    expect(prompt).toContain('OPEN CONVERSATION')
    expect(prompt).toContain('Learner level: A2')
    expect(prompt).toContain('valid JSON ONLY')
  })

  it('includes the learner supplied setup for custom roleplays', () => {
    const prompt = buildCustomConversationSystemPrompt(
      'I am checking into a hotel and the staff speaks politely.',
      'b1'
    )

    expect(prompt).toContain('CUSTOM CONVERSATION REQUEST')
    expect(prompt).toContain('checking into a hotel')
    expect(prompt).toContain('Learner level: B1')
  })
})
