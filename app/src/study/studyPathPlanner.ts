import type { LearningPath } from '../store'
import { nextCurriculumLessonId } from './firstRunBootstrap'
import { formatLessonLabel, lessonRouteFromId } from './studyPathRoutes'

export type StudyPathActionKind =
  | 'recovery'
  | 'review'
  | 'catch-up'
  | 'finish-speak'
  | 'cards-deferred'
  | 'current-lesson'
  | 'path-lesson'
  | 'extra-decks'
  | 'grammar'
  | 'mistakes'
  | 'generate-path'
  | 'free-study'

export interface StudyPathAction {
  kind: StudyPathActionKind
  title: string
  description: string
  actionLabel: string
  route?: string
  lessonId?: string
  meta?: string
  /** When kind is review/catch-up, which lane to study. */
  reviewLane?: 'path' | 'all'
}

export interface StudyPathPlannerInput {
  learningPath: LearningPath | null
  currentLesson: string | null
  lessonsCompleted: string[]
  /** Path-lane dues (lesson-linked + non-extra). Drives Today by default. */
  dueCount: number
  availableNewCount: number
  /** Extra Anki deck dues (unlinked imports). Do not block path unless opted in. */
  extraDueCount?: number
  includeExtraInToday?: boolean
  grammarDueCount: number
  mistakeCount: number
  reviewedToday: number
  dailyGoal: number
  hasRecovery: boolean
  /** Mid-lesson rail snapshot exists (localStorage). Prefer resume over LessonPage autostart. */
  hasResumableLesson?: boolean
  /** Durable skip flags when learner deferred Cards or left before Speak. */
  cardsDeferredLessonId?: string | null
  speakPendingLessonId?: string | null
  /** Soft escalation: when path dues exceed this, force catch-up mode. */
  dueBacklogThreshold?: number
}

export { formatLessonLabel, lessonRouteFromId }

function nextPathLesson(learningPath: LearningPath | null, completed: Set<string>) {
  return learningPath?.weeks
    .flatMap(week => week.lessons ?? [])
    .find(lesson => !completed.has(lesson.id)) ?? null
}

const DEFAULT_BACKLOG_THRESHOLD = 80

export function getStudyPathAction(input: StudyPathPlannerInput): StudyPathAction {
  const completed = new Set(input.lessonsCompleted)
  const includeExtra = Boolean(input.includeExtraInToday)
  const extraDue = input.extraDueCount ?? 0
  const effectiveDue = includeExtra ? input.dueCount + extraDue : input.dueCount
  const reviewLane: 'path' | 'all' = includeExtra ? 'all' : 'path'
  const backlogThreshold = input.dueBacklogThreshold ?? DEFAULT_BACKLOG_THRESHOLD

  if (input.hasRecovery) {
    return {
      kind: 'recovery',
      title: 'Resume your last review',
      description: 'An unfinished review session is waiting. Finish or close it before starting new path work.',
      actionLabel: 'Resume Session',
      meta: 'Recovery',
    }
  }

  if (effectiveDue >= backlogThreshold) {
    return {
      kind: 'catch-up',
      title: `Catch-up: ${effectiveDue} cards due`,
      description:
        'Review backlog is high. Clear path reviews before new lessons so spacing is not starved.',
      actionLabel: 'Start Catch-up Review',
      route: '/study/review',
      meta: 'Catch-up',
      reviewLane,
    }
  }

  if (effectiveDue > 0) {
    const grammarNote = input.grammarDueCount > 0
      ? ` Also ${input.grammarDueCount} grammar point${input.grammarDueCount === 1 ? '' : 's'} due (Review → Grammar after words).`
      : ''
    const extraNote =
      !includeExtra && extraDue > 0
        ? ` (${extraDue} Extra deck card${extraDue === 1 ? '' : 's'} wait under Review → Extra).`
        : includeExtra && extraDue > 0
          ? ` Includes ${extraDue} from Extra decks.`
          : ''
    return {
      kind: 'review',
      title: `Review ${effectiveDue} due card${effectiveDue === 1 ? '' : 's'}`,
      description: (input.availableNewCount > 0
        ? `Clear reviews first, then mix in up to ${input.availableNewCount} new card${input.availableNewCount === 1 ? '' : 's'}.`
        : 'Clear reviews first so the path does not outrun memory.') + grammarNote + extraNote,
      actionLabel: 'Start Review',
      route: '/study/review',
      meta: `${input.reviewedToday}/${input.dailyGoal} today`,
      reviewLane,
    }
  }

  // Skip debt: Cards deferred or Speak left unfinished — before starting a different lesson.
  const speakLesson = input.speakPendingLessonId
  if (speakLesson && !completed.has(speakLesson)) {
    return {
      kind: 'finish-speak',
      title: `Finish speaking — ${formatLessonLabel(speakLesson)}`,
      description:
        'You skipped or left Speak. Production is required before this lesson counts as done.',
      actionLabel: 'Resume Speak',
      route: lessonRouteFromId(speakLesson, { resume: true }),
      lessonId: speakLesson,
      meta: 'Speak pending',
    }
  }

  const deferredLesson = input.cardsDeferredLessonId
  if (deferredLesson && !completed.has(deferredLesson)) {
    return {
      kind: 'cards-deferred',
      title: `Review deferred cards — ${formatLessonLabel(deferredLesson)}`,
      description:
        'You queued Cards for later. Those items are due now — clear them before new encoding.',
      actionLabel: 'Review Lesson Cards',
      route: '/study/review',
      lessonId: deferredLesson,
      meta: 'Cards deferred',
      reviewLane: 'path',
    }
  }

  if (input.currentLesson && !completed.has(input.currentLesson)) {
    const resume = Boolean(input.hasResumableLesson)
    return {
      kind: 'current-lesson',
      title: `Continue ${formatLessonLabel(input.currentLesson)}`,
      description: resume
        ? 'Resume your in-progress lesson rail (teach → check → practice → cards → speak).'
        : 'Finish the active lesson sections, then review its linked cards.',
      actionLabel: resume ? 'Resume Lesson' : 'Continue Lesson',
      route: lessonRouteFromId(input.currentLesson, resume ? { resume: true } : { autostart: true }),
      lessonId: input.currentLesson,
      meta: resume ? 'Resume rail' : 'Active lesson',
    }
  }

  const nextLesson = nextPathLesson(input.learningPath, completed)
  if (nextLesson) {
    return {
      kind: 'path-lesson',
      title: `Start ${nextLesson.series} Lesson ${nextLesson.lessonNumber}`,
      description: 'This is the next textbook step from your saved Learning Path.',
      actionLabel: 'Start Path Lesson',
      route: lessonRouteFromId(nextLesson.id, { autostart: true }),
      lessonId: nextLesson.id,
      meta: 'Learning Path',
    }
  }

  // Path window caught up (or lessons list empty) — keep textbook momentum.
  if (input.learningPath) {
    const nextCurriculum = nextCurriculumLessonId(input.lessonsCompleted)
    if (nextCurriculum) {
      return {
        kind: 'path-lesson',
        title: `Start ${formatLessonLabel(nextCurriculum)}`,
        description: 'Your saved path weeks are caught up — continue the textbook curriculum.',
        actionLabel: 'Start Next Lesson',
        route: lessonRouteFromId(nextCurriculum, { autostart: true }),
        lessonId: nextCurriculum,
        meta: 'Curriculum',
      }
    }
  }

  // Extra decks only after path is clear (unless already included above).
  if (!includeExtra && extraDue > 0) {
    return {
      kind: 'extra-decks',
      title: `Study Extra Anki decks (${extraDue} due)`,
      description:
        'Path reviews are clear. Optional imported decks live under Review → Extra and do not block lessons.',
      actionLabel: 'Open Extra Decks',
      route: '/study/srs#extra-decks',
      meta: 'Extra Anki',
    }
  }

  if (input.grammarDueCount > 0) {
    return {
      kind: 'grammar',
      title: `Review ${input.grammarDueCount} grammar point${input.grammarDueCount === 1 ? '' : 's'}`,
      description: 'No word cards are due. Catalog grammar reviews are separate from lesson SRS cards.',
      actionLabel: 'Study Grammar',
      route: '/study/grammar',
      meta: 'Grammar SRS',
    }
  }

  if (input.mistakeCount > 0) {
    return {
      kind: 'mistakes',
      title: `Drill ${input.mistakeCount} recent mistake${input.mistakeCount === 1 ? '' : 's'}`,
      description: 'Clean up recent misses while they are still fresh.',
      actionLabel: 'Drill Mistakes',
      route: '/study/mistakes',
      meta: 'Weak points',
    }
  }

  if (!input.learningPath) {
    return {
      kind: 'generate-path',
      title: 'Create your Learning Path',
      description: 'Generate a CEFR-gated plan so Study can guide the next lesson sequence.',
      actionLabel: 'Open Learning Path',
      route: '/study/path',
      meta: 'Setup',
    }
  }

  return {
    kind: 'free-study',
    title: 'Choose your next study block',
    description: 'Your path is caught up for now. Browse lessons, scenarios, Extra decks, or add new content.',
    actionLabel: 'Open Learn',
    route: '/learn',
    meta: 'Caught up',
  }
}
