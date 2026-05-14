/**
 * Lesson Unlock Service
 * Handles matching Anki cards to lesson content and unlocking them
 */

import type { StorageProvider } from '../core/providers'
import { curriculumService } from './curriculumService'
import { lessonStructureService } from './lessonNormalization'
import { findBestMatch, extractLessonTerms } from './cardMatcher'

export interface UnlockMatch {
  cardId: number
  cardFront: string
  lessonTerm: string
  matchType: 'exact' | 'substring' | 'fuzzy'
  score: number
}

export interface UnlockResult {
  lessonId: string
  unlockedCount: number
  matches: UnlockMatch[]
  errors: string[]
}

/**
 * Unlock cards for a specific lesson
 * Matches Anki cards to lesson vocabulary and grammar
 * Updates card_states.lesson_id for matched cards
 */
export async function unlockCardsForLesson(
  lessonId: string,
  userId: number,
  storage: StorageProvider
): Promise<UnlockResult> {
  const errors: string[] = []
  const matches: UnlockMatch[] = []

  try {
    // Step 1: Load lesson structure
    const lesson = await lessonStructureService.getLesson(lessonId)
    if (!lesson) {
      return {
        lessonId,
        unlockedCount: 0,
        matches: [],
        errors: [`Lesson structure not found for ${lessonId}`]
      }
    }

    // Step 2: Load curriculum for the base textbook
    // The lesson.textbook and lesson.workbook contain original_id, but we need the normalized textbook name
    // We can derive it from the normalized_id
    const textbookMatch = lessonId.match(/^([a-z]+_[a-z0-9]+)_\d+$/)
    if (!textbookMatch) {
      return {
        lessonId,
        unlockedCount: 0,
        matches: [],
        errors: [`Cannot extract textbook from lesson ID: ${lessonId}`]
      }
    }

    const textbookBase = textbookMatch[1]
    const textbookName = `${textbookBase}_textbook`

    const curriculum = await curriculumService.getTextbookCurriculum(textbookName)
    if (!curriculum) {
      return {
        lessonId,
        unlockedCount: 0,
        matches: [],
        errors: [`Curriculum not found for textbook: ${textbookName}`]
      }
    }

    // Step 3: Extract lesson terms from curriculum
    const lessonNumber = lesson.lesson_number.toString()
    const vocabForLesson = curriculum.vocabulary.filter(v => v.lesson === lessonNumber)
    const grammarForLesson = curriculum.grammar.filter(g => g.lesson === lessonNumber)
    const lessonTerms = extractLessonTerms(vocabForLesson, grammarForLesson)

    if (lessonTerms.length === 0) {
      return {
        lessonId,
        unlockedCount: 0,
        matches: [],
        errors: [`No vocabulary or grammar found for lesson ${lessonNumber} in ${textbookName}`]
      }
    }

    // Step 4: Get all cards for the user
    const allCards = await storage.query<{ id: number; card_id: number; front: string }>(
      `SELECT cs.id, cs.card_id, c.front FROM card_states cs
       JOIN cards c ON c.id = cs.card_id
       WHERE cs.user_id = ?
       ORDER BY cs.id ASC`,
      [userId]
    )

    if (allCards.length === 0) {
      return {
        lessonId,
        unlockedCount: 0,
        matches: [],
        errors: ['No cards found for user']
      }
    }

    // Step 5: Match cards to lesson terms
    const matchedCardIds = new Set<number>()

    for (const card of allCards) {
      const match = findBestMatch(card.front, lessonTerms)
      if (match) {
        matches.push({
          cardId: card.card_id,
          cardFront: card.front,
          lessonTerm: match.lessonTerm,
          matchType: match.matchType,
          score: match.score
        })
        matchedCardIds.add(card.id) // Store card_state.id, not card.id
      }
    }

    // Step 6: Update card_states with lesson_id
    for (const cardStateId of matchedCardIds) {
      try {
        await storage.execute(
          `UPDATE card_states SET lesson_id = ? WHERE id = ?`,
          [lessonId, cardStateId]
        )
      } catch (error) {
        errors.push(`Failed to update card_state ${cardStateId}: ${String(error)}`)
      }
    }

    return {
      lessonId,
      unlockedCount: matchedCardIds.size,
      matches,
      errors
    }
  } catch (error) {
    return {
      lessonId,
      unlockedCount: 0,
      matches: [],
      errors: [`Unlock error: ${String(error)}`]
    }
  }
}

/**
 * Unlock cards for all lessons in a textbook
 * Useful when importing a new deck
 */
export async function unlockCardsForTextbook(
  textbookName: string,
  userId: number,
  storage: StorageProvider
): Promise<{ totalUnlocked: number; results: UnlockResult[] }> {
  const results: UnlockResult[] = []
  let totalUnlocked = 0

  try {
    const lessons = await lessonStructureService.getLessonsBySeries(
      textbookName.includes('genki_1') ? 'Genki I' :
      textbookName.includes('genki_2') ? 'Genki II' :
      textbookName.includes('marugoto_a1') ? 'Marugoto A1' :
      textbookName.includes('marugoto_a2') ? 'Marugoto A2' :
      textbookName.includes('marugoto_b1') ? 'Marugoto B1' :
      textbookName.includes('quartet_1') ? 'Quartet 1' :
      textbookName.includes('quartet_2') ? 'Quartet 2' :
      'Tobira'
    )

    for (const lesson of lessons) {
      const result = await unlockCardsForLesson(lesson.normalized_id, userId, storage)
      results.push(result)
      totalUnlocked += result.unlockedCount
    }
  } catch (error) {
    results.push({
      lessonId: textbookName,
      unlockedCount: 0,
      matches: [],
      errors: [`Textbook unlock error: ${String(error)}`]
    })
  }

  return { totalUnlocked, results }
}
