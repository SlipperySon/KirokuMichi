import { describe, expect, it } from 'vitest'
import { deckNameFromApkg, laneFilterSql } from './deckLane'

describe('deckLane', () => {
  it('strips .apkg for deck names', () => {
    expect(deckNameFromApkg('Core_2k.apkg')).toBe('Core_2k')
    expect(deckNameFromApkg('deck')).toBe('deck')
  })

  it('builds lane SQL filters', () => {
    expect(laneFilterSql('all')).toBe('')
    expect(laneFilterSql(undefined)).toBe('')
    expect(laneFilterSql('path')).toContain('extra')
    expect(laneFilterSql('extra')).toContain("= 'extra'")
  })
})
