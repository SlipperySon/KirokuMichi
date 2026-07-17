import type { ReviewCard } from './types'

/**
 * Anki-style interleave: up to 5 due cards, then 1 new, repeat.
 * Keeps reviews ahead of new introductions so spacing is not starved.
 */
export function interleaveDueAndNew(
  due: ReviewCard[],
  newCards: ReviewCard[],
  limit: number,
): ReviewCard[] {
  const queue: ReviewCard[] = []
  let di = 0
  let ni = 0
  while (queue.length < limit && (di < due.length || ni < newCards.length)) {
    for (let i = 0; i < 5 && di < due.length && queue.length < limit; i++) {
      queue.push(due[di++])
    }
    if (ni < newCards.length && queue.length < limit) {
      queue.push(newCards[ni++])
    }
  }
  return queue
}
