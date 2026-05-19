import { describe, it, expect } from 'vitest'
import { stripHtml, deriveJlptLevel, extractSoundFilename, parseAnkiNote, deriveGenkiLessonId } from './ankiImport'

describe('stripHtml', () => {
  it('removes basic HTML tags', () => {
    expect(stripHtml('<b>word</b>')).toBe('word')
    expect(stripHtml('<div><span>text</span></div>')).toBe('text')
  })

  it('replaces &nbsp; with a regular space', () => {
    expect(stripHtml('hello&nbsp;world')).toBe('hello world')
  })

  it('decodes common HTML entities', () => {
    expect(stripHtml('&amp;')).toBe('&')
    expect(stripHtml('&lt;b&gt;')).toBe('<b>')
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"')
    expect(stripHtml('it&#39;s')).toBe("it's")
    expect(stripHtml('&#12354;')).toBe('あ')
  })

  it('converts <br> to a space instead of removing it silently', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1 line2')
    expect(stripHtml('line1<br/>line2')).toBe('line1 line2')
    expect(stripHtml('line1<BR />line2')).toBe('line1 line2')
  })

  it('collapses multiple whitespace into one', () => {
    expect(stripHtml('hello   world')).toBe('hello world')
    expect(stripHtml('word1  <br>  word2')).toBe('word1 word2')
  })

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello')
    expect(stripHtml('  <b> hello </b>  ')).toBe('hello')
  })

  it('handles already-clean text unchanged', () => {
    expect(stripHtml('食べる')).toBe('食べる')
    expect(stripHtml('to eat')).toBe('to eat')
  })

  it('handles empty and whitespace-only strings', () => {
    expect(stripHtml('')).toBe('')
    expect(stripHtml('   ')).toBe('')
    expect(stripHtml('<b></b>')).toBe('')
  })

  it('handles deeply nested and malformed tags', () => {
    expect(stripHtml('<div class="foo"><p><b>word</b></p></div>')).toBe('word')
    expect(stripHtml('<ruby>漢字<rt>かんじ</rt></ruby>')).toBe('漢字かんじ')
  })
})

describe('deriveJlptLevel', () => {
  it('detects N1–N5 case-insensitively', () => {
    expect(deriveJlptLevel('N5 vocabulary')).toBe('N5')
    expect(deriveJlptLevel('n3')).toBe('N3')
    expect(deriveJlptLevel('tag1 N2 tag2')).toBe('N2')
  })

  it('returns the level in uppercase', () => {
    expect(deriveJlptLevel('n1 advanced')).toBe('N1')
  })

  it('requires a word boundary so plain digits do not match', () => {
    expect(deriveJlptLevel('N15')).toBeNull()
    expect(deriveJlptLevel('vocabulary')).toBeNull()
  })

  it('returns null for empty or unrelated tags', () => {
    expect(deriveJlptLevel('')).toBeNull()
    expect(deriveJlptLevel('japanese genki')).toBeNull()
  })
})

describe('extractSoundFilename', () => {
  it('extracts the filename from a [sound:…] tag', () => {
    expect(extractSoundFilename('[sound:audio.mp3]')).toBe('audio.mp3')
    expect(extractSoundFilename('[sound:aud.ogg]')).toBe('aud.ogg')
  })

  it('handles filenames with spaces, hyphens, underscores, and unicode', () => {
    expect(extractSoundFilename('[sound:my file.mp3]')).toBe('my file.mp3')
    expect(extractSoundFilename('[sound:genki-l1-p30.mp3]')).toBe('genki-l1-p30.mp3')
    expect(extractSoundFilename('[sound:食べる.mp3]')).toBe('食べる.mp3')
  })

  it('finds the tag within a larger field string', () => {
    expect(extractSoundFilename('word [sound:audio.mp3] extra text')).toBe('audio.mp3')
  })

  it('returns null when there is no [sound:…] tag', () => {
    expect(extractSoundFilename('no sound here')).toBeNull()
    expect(extractSoundFilename('')).toBeNull()
    expect(extractSoundFilename('[text:not-a-sound]')).toBeNull()
  })
})

describe('deriveGenkiLessonId', () => {
  it('maps Genki official app tags to learner-facing lesson ids', () => {
    expect(deriveGenkiLessonId('genki-L00')).toBe('genki_1_1')
    expect(deriveGenkiLessonId('vocab genki-L01')).toBe('genki_1_1')
    expect(deriveGenkiLessonId('genki-L12')).toBe('genki_1_12')
    expect(deriveGenkiLessonId('genki-L13')).toBe('genki_2_1')
    expect(deriveGenkiLessonId('genki-L23')).toBe('genki_2_11')
  })

  it('returns null for non-Genki or out-of-range tags', () => {
    expect(deriveGenkiLessonId('')).toBeNull()
    expect(deriveGenkiLessonId('kaishi N5')).toBeNull()
    expect(deriveGenkiLessonId('genki-L24')).toBeNull()
  })
})

// Helper to build a raw Anki flds string (fields separated by 0x1f)
function mkFlds(...fields: string[]): string {
  return fields.join('\x1f')
}

describe('parseAnkiNote', () => {
  describe('generic 2-field deck', () => {
    it('parses front and back from a simple 2-field deck', () => {
      const parsed = parseAnkiNote(mkFlds('食べる', 'to eat'), '')
      expect(parsed).not.toBeNull()
      expect(parsed!.front).toBe('食べる')
      expect(parsed!.back).toBe('to eat')
      expect(parsed!.reading).toBeNull()
      expect(parsed!.isKaishi).toBe(false)
    })

    it('strips HTML from front and back fields', () => {
      const parsed = parseAnkiNote(mkFlds('<b>食べる</b>', '<i>to eat</i>'), '')
      expect(parsed!.front).toBe('食べる')
      expect(parsed!.back).toBe('to eat')
    })

    it('extracts optional reading from 3-field decks', () => {
      const parsed = parseAnkiNote(mkFlds('食べる', 'to eat', 'たべる'), '')
      expect(parsed!.reading).toBe('たべる')
    })

    it('returns null for empty reading field', () => {
      const parsed = parseAnkiNote(mkFlds('word', 'meaning', ''), '')
      expect(parsed!.reading).toBeNull()
    })

    it('returns null when front is empty', () => {
      expect(parseAnkiNote(mkFlds('', 'meaning'), '')).toBeNull()
    })

    it('returns null when back is empty', () => {
      expect(parseAnkiNote(mkFlds('front', ''), '')).toBeNull()
    })

    it('returns null when front strips to empty HTML', () => {
      expect(parseAnkiNote(mkFlds('<b></b>', 'meaning'), '')).toBeNull()
    })

    it('detects [sound:…] in any generic field', () => {
      const parsed = parseAnkiNote(mkFlds('word', 'meaning [sound:audio.mp3]'), '')
      expect(parsed!.wordAudioField).toContain('[sound:audio.mp3]')
    })
  })

  describe('Kaishi 1.5k deck', () => {
    // Kaishi fields: Word | WordReading | WordMeaning | WordFurigana | WordAudio | Sentence | SentenceMeaning | SentenceFurigana | SentenceAudio | Notes | PitchAccent | Frequency | Picture
    function kaishiFlds(overrides: Partial<Record<number, string>> = {}): string {
      const defaults = [
        '食べる',           // 0 Word
        'たべる',           // 1 WordReading
        'to eat',          // 2 WordMeaning
        '食(た)べる',      // 3 WordFurigana
        '[sound:taberu.mp3]', // 4 WordAudio
        '毎日食べる。',     // 5 Sentence
        'I eat every day.', // 6 SentenceMeaning
        '',                 // 7 SentenceFurigana
        '[sound:sentence.mp3]', // 8 SentenceAudio
        '',                 // 9 Notes
        '',                 // 10 PitchAccent
        '42',               // 11 Frequency
        '',                 // 12 Picture
      ]
      for (const [i, v] of Object.entries(overrides)) if (v !== undefined) defaults[Number(i)] = v
      return defaults.join('\x1f')
    }

    it('detects Kaishi format by field count + WordAudio presence', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.isKaishi).toBe(true)
    })

    it('parses Word as front and WordMeaning as back', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.front).toBe('食べる')
      expect(parsed!.back).toBe('to eat')
    })

    it('parses WordReading into reading', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.reading).toBe('たべる')
    })

    it('extracts the word audio field', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.wordAudioField).toBe('[sound:taberu.mp3]')
    })

    it('parses sentence and sentenceMeaning', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.sentence).toBe('毎日食べる。')
      expect(parsed!.sentenceMeaning).toBe('I eat every day.')
    })

    it('parses frequency rank as a number', () => {
      const parsed = parseAnkiNote(kaishiFlds(), '')
      expect(parsed!.frequencyRank).toBe(42)
    })

    it('treats non-numeric frequency as null', () => {
      const parsed = parseAnkiNote(kaishiFlds({ 11: 'N/A' }), '')
      expect(parsed!.frequencyRank).toBeNull()
    })

    it('returns null sentence fields when they are empty', () => {
      const parsed = parseAnkiNote(kaishiFlds({ 5: '', 6: '' }), '')
      expect(parsed!.sentence).toBeNull()
      expect(parsed!.sentenceMeaning).toBeNull()
    })

    it('strips HTML from sentence fields', () => {
      const parsed = parseAnkiNote(kaishiFlds({ 5: '<b>毎日食べる。</b>', 6: '<i>I eat every day.</i>' }), '')
      expect(parsed!.sentence).toBe('毎日食べる。')
      expect(parsed!.sentenceMeaning).toBe('I eat every day.')
    })

    it('falls back to generic parsing when WordAudio field is missing the [sound:] marker', () => {
      // Change field 4 to not contain a sound tag → not Kaishi
      const parsed = parseAnkiNote(kaishiFlds({ 4: '' }), '')
      expect(parsed!.isKaishi).toBe(false)
    })
  })

  describe('Genki official app deck', () => {
    function genkiFlds(overrides: Partial<Record<number, string>> = {}): string {
      const defaults = [
        'Excuse me.',          // 0 English prompt
        'すみません',          // 1 Japanese expression
        '',                    // 2 unused
        '',                    // 3 unused
        '',                    // 4 unused
        '[sound:genki.mp3]',   // 5 word audio
        '',                    // 6 unused
        'すみません、今何時ですか。', // 7 example sentence
        'Excuse me, what time is it now?', // 8 sentence meaning
      ]
      for (const [i, v] of Object.entries(overrides)) if (v !== undefined) defaults[Number(i)] = v
      return defaults.join('\x1f')
    }

    it('uses Japanese as the front and English as the back', () => {
      const parsed = parseAnkiNote(genkiFlds(), 'genki-L01')
      expect(parsed).not.toBeNull()
      expect(parsed!.front).toBe('すみません')
      expect(parsed!.back).toBe('Excuse me.')
      expect(parsed!.wordAudioField).toBe('[sound:genki.mp3]')
      expect(parsed!.sourceLessonId).toBe('genki_1_1')
    })

    it('maps Genki II official app tags to core lesson ids', () => {
      const parsed = parseAnkiNote(genkiFlds({ 0: 'to be late', 1: '遅れる' }), 'foo genki-L13')
      expect(parsed!.front).toBe('遅れる')
      expect(parsed!.back).toBe('to be late')
      expect(parsed!.sourceLessonId).toBe('genki_2_1')
    })

    it('imports official example sentences as sentence card material', () => {
      const parsed = parseAnkiNote(genkiFlds(), 'genki-L01')
      expect(parsed!.sentence).toBe('すみません、今何時ですか。')
      expect(parsed!.sentenceMeaning).toBe('Excuse me, what time is it now?')
    })
  })

  describe('edge cases', () => {
    it('handles a single-field note gracefully (returns null)', () => {
      expect(parseAnkiNote('only-front', '')).toBeNull()
    })

    it('handles very long front/back fields without truncating', () => {
      const long = 'A'.repeat(2000)
      const parsed = parseAnkiNote(mkFlds(long, 'meaning'), '')
      expect(parsed!.front).toBe(long)
    })

    it('preserves Japanese and special unicode in front/back', () => {
      const parsed = parseAnkiNote(mkFlds('食べる・飲む', '食(た)べる'), '')
      expect(parsed!.front).toBe('食べる・飲む')
    })

    it('returns null when the entire flds string is empty', () => {
      expect(parseAnkiNote('', '')).toBeNull()
    })

    it('handles windows-style &amp; in front field', () => {
      const parsed = parseAnkiNote(mkFlds('A &amp; B', 'and'), '')
      expect(parsed!.front).toBe('A & B')
    })
  })
})
