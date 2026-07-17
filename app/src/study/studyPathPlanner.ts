import type { LearningPath } from '../store'
import { nextCurriculumLessonId } from './firstRunBootstrap'

export type StudyPathActionKind =
  | 'recovery'
  | 'review'
  | 'current-lesson'
  | 'path-lesson'
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
}

export interface StudyPathPlannerInput {
  learningPath: LearningPath | null
  currentLesson: string | null
  lessonsCompleted: string[]
  dueCount: number
  availableNewCount: number
  grammarDueCount: number
  mistakeCount: number
  reviewedToday: number
  dailyGoal: number
  hasRecovery: boolean
  /** Mid-lesson rail snapshot exists (localStorage). Prefer resume over LessonPage autostart. */
  hasResumableLesson?: boolean
}

export function lessonRouteFromId(lessonId: string, options?: { autostart?: boolean; resume?: boolean }) {
  if (options?.resume) {
    return `/learn/study?resume=${encodeURIComponent(lessonId)}`
  }
  const match = lessonId.match(/^(genki_[12]|quartet_[12])_(\d+)$/)
  if (!match) return '/learn'
  const [, series, lessonNumber] = match
  const cefr = series === 'genki_1'
    ? 'a1'
    : series === 'genki_2'
      ? 'a2'
      : series === 'quartet_1'
        ? 'b1'
        : 'b2'
  const base = `/learn/lessons/${cefr}/${lessonNumber}`
  return options?.autostart ? `${base}?autostart=1` : base
}

export function formatLessonLabel(lessonId: string) {
  return lessonId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function nextPathLesson(learningPath: LearningPath | null, completed: Set<string>) {
  return learningPath?.weeks
    .flatMap(week => week.lessons ?? [])
    .find(lesson => !completed.has(lesson.id)) ?? null
}

export function getStudyPathAction(input: StudyPathPlannerInput): StudyPathAction {
  const completed = new Set(input.lessonsCompleted)

  if (input.hasRecovery) {
    return {
      kind: 'recovery',
      title: 'Resume your last review',
      description: 'An unfinished review session is waiting. Finish or close it before starting new path work.',
      actionLabel: 'Resume Session',
      meta: 'Recovery',
    }
  }

  if (input.dueCount > 0) {
    return {
      kind: 'review',
      title: `Review ${input.dueCount} due card${input.dueCount === 1 ? '' : 's'}`,
      description: input.availableNewCount > 0
        ? `Clear reviews first, then mix in up to ${input.availableNewCount} new card${input.availableNewCount === 1 ? '' : 's'}.`
        : 'Clear reviews first so the path does not outrun memory.',
      actionLabel: 'Start Review',
      route: '/study/review',
      meta: `${input.reviewedToday}/${input.dailyGoal} today`,
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

  if (input.grammarDueCount > 0) {
    return {
      kind: 'grammar',
      title: `Review ${input.grammarDueCount} grammar point${input.grammarDueCount === 1 ? '' : 's'}`,
      description: 'Grammar reviews are due separately from vocabulary cards.',
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
    description: 'Your path is caught up for now. Browse lessons, scenarios, or add new content.',
    actionLabel: 'Open Learn',
    route: '/learn',
    meta: 'Caught up',
  }
}
