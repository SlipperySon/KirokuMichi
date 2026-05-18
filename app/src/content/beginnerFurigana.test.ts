import { describe, expect, it } from 'vitest'
import { annotateBeginnerFurigana, isBeginnerLevel } from './beginnerFurigana'

describe('beginner furigana', () => {
  it('annotates common A1/A2 scenario kanji without splitting longer terms', () => {
    expect(annotateBeginnerFurigana('日本語は難しいですが、楽しいです。')).toBe(
      '日本語(にほんご)は難しい(むずかしい)ですが、楽しい(たのしい)です。'
    )
  })

  it('does not double-annotate existing inline furigana', () => {
    expect(annotateBeginnerFurigana('日本語(にほんご)の先生です。')).toBe(
      '日本語(にほんご)の先生(せんせい)です。'
    )
  })

  it('only treats A1 and A2 as beginner scenario levels', () => {
    expect(isBeginnerLevel('A1')).toBe(true)
    expect(isBeginnerLevel('A2')).toBe(true)
    expect(isBeginnerLevel('B1')).toBe(false)
  })
})
