import type { SRSService } from '../srs/srsService'
import type { ReviewCard, GrammarQuestion } from './types'
import type { VocabItem, GrammarItem } from './lessonStudyPlanner'
import { repairLessonCardLinks } from '../content/lessonUnlockService'
import { grammarCardFields, grammarEntriesFromCards } from './grammarCardBuilder'

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

export interface LessonReviewPayload {
  queue: ReviewCard[]
  grammarEntries: [number, GrammarQuestion][]
}

/**
 * Ensure lesson vocab + grammar exist as SRS cards linked to the lesson.
 */
export async function ensureLessonCards(
  service: SRSService,
  userId: number,
  lessonId: string,
  vocab: VocabItem[],
  grammar: GrammarItem[] = [],
): Promise<{ linked: number; created: number; grammarCreated: number }> {
  const repair = await repairLessonCardLinks(lessonId, userId, service.storage, vocab, grammar)
  let created = 0
  let grammarCreated = 0

  const existing = await service.getCardsForLesson(userId, lessonId)
  const existingFronts = new Set(existing.map(card => normalizeFront(card.front)))

  const deckId = await service.ensureDefaultDeck(userId)

  for (const item of vocabToSeedItems(vocab)) {
    const key = normalizeFront(item.front)
    if (!key || existingFronts.has(key)) continue

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
      cardType: 'vocabulary',
    })
    existingFronts.add(key)
    created += 1
  }

  for (const item of grammar.filter(g => g.pattern && g.meaning)) {
    const fields = grammarCardFields(item)
    const key = normalizeFront(fields.front)
    if (!key || existingFronts.has(key)) continue

    await service.createUserCard(userId, {
      front: fields.front,
      back: fields.back,
      deckId,
      lessonId,
      originType: 'lesson_grammar',
      originRef: item.id,
      exampleSentence: fields.exampleSentence,
      exampleTranslation: fields.exampleTranslation,
      cardType: 'grammar',
    })
    existingFronts.add(key)
    grammarCreated += 1
  }

  await service.activateGrammarForLesson(userId, grammar)

  return { linked: repair.unlockedCount, created, grammarCreated }
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

/** Build review queue + grammar cloze entries for ReviewSession. */
export async function buildLessonReviewPayload(
  service: SRSService,
  userId: number,
  lessonId: string,
  vocab: VocabItem[],
  grammar: GrammarItem[],
  options: BuildLessonReviewQueueOptions = {},
): Promise<LessonReviewPayload> {
  const queue = await buildLessonReviewQueue(service, userId, lessonId, options)
  const grammarByFront = new Map(grammar.map(g => [g.pattern, g]))
  const patterns = grammar.map(g => g.pattern).filter(Boolean)
  const grammarEntries = grammarEntriesFromCards(queue, grammarByFront, patterns)
  return { queue, grammarEntries }
}

/** Mark deferred lesson cards as due today (spacing commitment without finishing intro review now). */
export async function commitDeferredLessonCards(
  service: SRSService,
  userId: number,
  lessonId: string,
  vocab: VocabItem[],
  grammar: GrammarItem[],
): Promise<number> {
  await ensureLessonCards(service, userId, lessonId, vocab, grammar)
  await service.storage.execute(
    `UPDATE card_states
     SET due = datetime('now'), state = CASE WHEN state = 'review' THEN state ELSE 'new' END
     WHERE user_id = ? AND lesson_id = ?`,
    [userId, lessonId],
  )
  const rows = await service.storage.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM card_states WHERE user_id = ? AND lesson_id = ?`,
    [userId, lessonId],
  )
  return rows[0]?.count ?? 0
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
