import type { SRSService } from '../srs/srsService'
import type { ReviewCard } from './types'
import type { VocabItem, GrammarItem } from './lessonStudyPlanner'
import { repairLessonCardLinks } from '../content/lessonUnlockService'

export const LESSON_INTRO_REVIEW_CAP = 12

export interface LessonCardSeedItem {
  id: string
  front: string
  back: string
  reading?: string | null
  originRef?: string
}

export interface BuildLessonReviewQueueOptions {
  /** Prefer these fronts / surfaces first (teach again + quiz misses). */
  priorityFronts?: string[]
  /** Max cards for an intro pass after a lesson. */
  limit?: number
}

function normalizeFront(value: string): string {
  return value.trim().toLowerCase()
}

/** Map teach/quiz item ids to card fronts for priority ordering. */
export function priorityFrontsFromLessonSignals(input: {
  vocab: VocabItem[]
  grammar: GrammarItem[]
  againItemIds: string[]
  missedItemIds: string[]
}): string[] {
  const idSet = new Set([...input.againItemIds, ...input.missedItemIds])
  const fronts: string[] = []
  for (const item of input.vocab) {
    if (idSet.has(`vocab:${item.id}`) || idSet.has(item.id)) fronts.push(item.surface)
  }
  for (const item of input.grammar) {
    if (idSet.has(`grammar:${item.id}`) || idSet.has(item.id)) fronts.push(item.pattern)
  }
  return fronts
}

export function vocabToSeedItems(vocab: VocabItem[]): LessonCardSeedItem[] {
  return vocab.map(item => ({
    id: item.id,
    front: item.surface,
    back: item.english,
    reading: null,
    originRef: item.id,
  }))
}

/**
 * Ensure lesson vocab exists as SRS cards linked to the lesson.
 * Repairs existing Anki links first, then creates missing vocab cards.
 */
export async function ensureLessonCards(
  service: SRSService,
  userId: number,
  lessonId: string,
  vocab: VocabItem[],
  grammar: GrammarItem[] = [],
): Promise<{ linked: number; created: number }> {
  const repair = await repairLessonCardLinks(lessonId, userId, service.storage, vocab, grammar)
  let created = 0

  const existing = await service.getCardsForLesson(userId, lessonId)
  const existingFronts = new Set(existing.map(card => normalizeFront(card.front)))

  const deckId = await service.ensureDefaultDeck(userId)

  for (const item of vocabToSeedItems(vocab)) {
    const key = normalizeFront(item.front)
    if (!key || existingFronts.has(key)) continue

    // Also skip if an unlinked card with the same front already exists — link it instead.
    const rows = await service.storage.query<{ cardStateId: number; cardId: number }>(
      `SELECT cs.id AS cardStateId, cs.card_id AS cardId
       FROM card_states cs
       JOIN cards c ON c.id = cs.card_id
       WHERE cs.user_id = ? AND lower(trim(c.front)) = ?
       LIMIT 1`,
      [userId, key],
    )
    if (rows[0]) {
      await service.storage.execute(
        `UPDATE card_states SET lesson_id = ? WHERE id = ? AND user_id = ?`,
        [lessonId, rows[0].cardStateId, userId],
      )
      await service.storage.execute(
        `INSERT OR IGNORE INTO lesson_vocabulary (user_id, lesson_id, card_id, term)
         VALUES (?, ?, ?, ?)`,
        [userId, lessonId, rows[0].cardId, item.front],
      )
      existingFronts.add(key)
      continue
    }

    await service.createUserCard(userId, {
      front: item.front,
      back: item.back,
      reading: item.reading ?? null,
      deckId,
      lessonId,
      originType: 'lesson_vocab',
      originRef: item.originRef ?? item.id,
    })
    existingFronts.add(key)
    created += 1
  }

  return { linked: repair.unlockedCount, created }
}

/**
 * Build a capped, priority-ordered lesson review queue for the Cards step.
 * Excludes suspended/buried cards when those columns are present in query results.
 */
export async function buildLessonReviewQueue(
  service: SRSService,
  userId: number,
  lessonId: string,
  options: BuildLessonReviewQueueOptions = {},
): Promise<ReviewCard[]> {
  const limit = options.limit ?? LESSON_INTRO_REVIEW_CAP
  const priority = (options.priorityFronts ?? []).map(normalizeFront).filter(Boolean)
  const prioritySet = new Set(priority)

  // Fetch more than limit so we can re-order priorities, then slice.
  const cards = await service.getCardsForLesson(userId, lessonId, Math.max(limit * 3, 40))
  const active = cards.filter(card => {
    // getCardsForLesson already excludes leeches; suspend/bury filtered in service update.
    return true
  })

  const prioritized = active.filter(card => prioritySet.has(normalizeFront(card.front)))
  const rest = active.filter(card => !prioritySet.has(normalizeFront(card.front)))

  // Within rest, prefer new/learning before mature review for intro pass.
  const stateRank = (state: ReviewCard['state']) =>
    state === 'new' ? 0 : state === 'learning' || state === 'relearning' ? 1 : 2
  rest.sort((a, b) => stateRank(a.state) - stateRank(b.state) || a.cardStateId - b.cardStateId)

  const ordered = [...prioritized, ...rest]
  const seen = new Set<number>()
  const queue: ReviewCard[] = []
  for (const card of ordered) {
    if (seen.has(card.cardStateId)) continue
    seen.add(card.cardStateId)
    queue.push(card)
    if (queue.length >= limit) break
  }
  return queue
}

/** Pure helper for tests: order cards with priority fronts first. */
export function orderLessonReviewCards(
  cards: ReviewCard[],
  priorityFronts: string[],
  limit = LESSON_INTRO_REVIEW_CAP,
): ReviewCard[] {
  const prioritySet = new Set(priorityFronts.map(normalizeFront))
  const prioritized = cards.filter(card => prioritySet.has(normalizeFront(card.front)))
  const rest = cards.filter(card => !prioritySet.has(normalizeFront(card.front)))
  return [...prioritized, ...rest].slice(0, limit)
}
