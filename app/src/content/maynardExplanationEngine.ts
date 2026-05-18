import type { GrammarItem } from './curriculumService'
import { getMaynardSupport } from './maynardSupport'

export interface GrammarExplanationPlan {
  basicExplanation: string
  maynardDeepExplanation?: string
  contrastWithNearbyGrammar?: string
  commonMistake: string
  examplePattern: string
  maynardTitle?: string
}

function firstSentence(text: string | undefined) {
  const cleaned = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const split = cleaned.match(/^.*?[.!?。！？](?:\s|$)/)
  return (split?.[0] ?? cleaned).trim()
}

function examplePattern(grammar: GrammarItem) {
  const example = grammar.examples?.[0]
  if (example?.japanese) return example.japanese
  return `${grammar.pattern} + phrase`
}

function contrast(grammar: GrammarItem, nearbyGrammar: GrammarItem[]) {
  const nearby = nearbyGrammar.find(item => item.id !== grammar.id && item.pattern !== grammar.pattern)
  if (!nearby) return undefined

  if (grammar.pattern === 'は' && nearby.pattern === 'が') {
    return 'Use は to set the topic you are talking about; use が when identifying or highlighting the subject itself.'
  }
  if (grammar.pattern === 'が' && nearby.pattern === 'は') {
    return 'Use が when the subject is being identified or newly noticed; use は when the subject is already the topic.'
  }
  if (grammar.pattern === 'です' && nearby.pattern === 'だ') {
    return 'です is the polite classroom/default form; だ is casual and should wait until the situation allows plain speech.'
  }
  if (grammar.pattern === 'だ' && nearby.pattern === 'です') {
    return 'だ carries the same basic copula job as です, but it sounds casual and is not the safe default with strangers or teachers.'
  }
  if (grammar.pattern === 'これ' && nearby.pattern === 'それ') {
    return 'これ points to something near the speaker; それ points to something near the listener or already mentioned.'
  }
  if (grammar.pattern === 'それ' && nearby.pattern === 'これ') {
    return 'それ points away from the speaker toward the listener or prior context; これ points to the speaker side.'
  }

  return `Do not treat ${grammar.pattern} as interchangeable with ${nearby.pattern}; compare the sentence job before choosing.`
}

function commonMistake(grammar: GrammarItem) {
  if (grammar.pattern === 'は') return 'Do not translate は as “is.” It marks the topic; the sentence still needs a predicate.'
  if (grammar.pattern === 'が') return 'Do not use が only because English has a subject. In Japanese it often highlights new or identified information.'
  if (grammar.pattern === 'です') return 'Do not attach です directly to every verb. It mainly closes noun and adjective-style polite statements.'
  if (grammar.pattern === 'の') return 'Do not reverse the noun order: A の B usually means B connected to or belonging to A.'
  if (grammar.pattern === 'か') return 'Do not add English question word order. Keep the Japanese sentence order and add か at the end.'
  if (grammar.pattern === 'も') return 'Do not stack は and も together for the same noun; も replaces the topic marker in simple “also” sentences.'
  if (/これ|それ|あれ/.test(grammar.pattern)) return 'Do not choose by English “this/that” alone; choose by distance from speaker and listener.'
  if (/から見ると|逆に|だけに/.test(grammar.pattern)) return 'Do not present the viewpoint as a universal fact; name whose perspective or consequence you are using.'
  if (/ざるを得ない|よりほかない|上は|からには/.test(grammar.pattern)) return 'Do not use this for a mild preference; it means pressure, responsibility, or no realistic alternative remains.'
  return `Do not memorize ${grammar.pattern} as a single English word. Learn the sentence job it performs.`
}

export function buildGrammarExplanationPlan(
  grammar: GrammarItem,
  nearbyGrammar: GrammarItem[] = []
): GrammarExplanationPlan {
  const maynardRef = getMaynardSupport(grammar)
  const maynardExcerpt = maynardRef?.excerpt.replace(/\s+/g, ' ').trim()
  const maynardDeepExplanation = maynardExcerpt
    ? maynardExcerpt.slice(0, 420) + (maynardExcerpt.length > 420 ? '...' : '')
    : undefined

  return {
    basicExplanation: firstSentence(grammar.explanation) || grammar.meaning,
    maynardDeepExplanation,
    contrastWithNearbyGrammar: contrast(grammar, nearbyGrammar),
    commonMistake: commonMistake(grammar),
    examplePattern: examplePattern(grammar),
    maynardTitle: maynardRef?.title,
  }
}
