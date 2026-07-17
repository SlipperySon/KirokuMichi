import { describe, expect, it } from 'vitest'
import { detectTextbook } from './textbookDetection'

describe('detectTextbook', () => {
  it('detects routed core textbook files with high confidence', () => {
    expect(detectTextbook('Genki I Integrated Course textbook.apkg')).toMatchObject({
      textbookKey: 'genki_1',
      confidence: 0.9,
    })
    expect(detectTextbook('Quartet 2 intermediate japanese workbook.apkg')).toMatchObject({
      textbookKey: 'quartet_2',
      confidence: 0.9,
    })
  })

  it('detects Marugoto level-specific filenames', () => {
    expect(detectTextbook('marugoto_a1_katsudoo.pdf')).toMatchObject({
      textbookKey: 'marugoto_a1',
      confidence: 0.9,
    })
    expect(detectTextbook('Marugoto B1 topic notes.pdf')).toMatchObject({
      textbookKey: 'marugoto_b1',
      confidence: 0.85,
    })
  })

  it('keeps ambiguous files unmapped', () => {
    expect(detectTextbook('random-vocab-export.apkg')).toMatchObject({
      textbookKey: null,
      confidence: 0,
    })
  })
})
