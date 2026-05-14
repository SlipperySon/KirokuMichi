/**
 * Ruby
 *
 * Parses inline furigana annotations of the form `漢字(かんじ)` and renders
 * them as <ruby>…<rt>…</rt></ruby>. Anything outside the parentheses passes
 * through unchanged. When `showFurigana` is false, the readings are stripped
 * and only the base text is rendered.
 *
 * Heuristic: a parenthesised group is treated as furigana iff:
 *   - the character immediately before it is CJK Unified Ideograph (U+4E00..U+9FFF) or
 *     hiragana/katakana, AND
 *   - the parenthesised content contains kana or alphabetic characters only.
 *
 * This avoids false positives like English parentheticals "(see below)".
 */

import { Fragment } from 'react'

interface RubyProps {
  text: string
  showFurigana?: boolean
  className?: string
}

const FURIGANA_RE = /([一-鿿぀-ゟ゠-ヿ々ヶ]+)\(([぀-ゟ゠-ヿa-zA-Z]+)\)/g

export function Ruby({ text, showFurigana = true, className }: RubyProps) {
  if (!text.includes('(')) {
    return <span className={className} lang="ja">{text}</span>
  }

  const segments: Array<{ type: 'plain'; text: string } | { type: 'ruby'; base: string; rt: string }> = []
  let lastIndex = 0
  for (const match of text.matchAll(FURIGANA_RE)) {
    const [whole, base, rt] = match
    const start = match.index ?? 0
    if (start > lastIndex) segments.push({ type: 'plain', text: text.slice(lastIndex, start) })
    segments.push({ type: 'ruby', base, rt })
    lastIndex = start + whole.length
  }
  if (lastIndex < text.length) segments.push({ type: 'plain', text: text.slice(lastIndex) })

  return (
    <span className={className} lang="ja">
      {segments.map((seg, i) =>
        seg.type === 'plain' ? (
          <Fragment key={i}>{seg.text}</Fragment>
        ) : showFurigana ? (
          <ruby key={i}>
            {seg.base}
            <rt className="text-[0.6em] text-gray-500">{seg.rt}</rt>
          </ruby>
        ) : (
          <Fragment key={i}>{seg.base}</Fragment>
        )
      )}
    </span>
  )
}
