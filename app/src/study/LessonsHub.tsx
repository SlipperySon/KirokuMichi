/**
 * Lessons Hub - CEFR Level Selector
 * Main entry point for lesson-based studying
 * Users select their proficiency level (A1-C1) to access lessons
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Dumbbell, Home, Layers } from 'lucide-react'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../content/cefrMapping'
import { curriculumService } from '../content/curriculumService'
import { createLessonMatcher } from '../content/lessonContentUtils'
import { getWorkbookPracticeTasks } from '../content/workbookPracticeService'
import { Navigation } from '../components/Navigation'
import { EmptyState } from '../components/EmptyState'
import { TextbookProgress } from './TextbookProgress'

// Display names for each base textbook (kept in sync with cefrMapping.ts)
const TEXTBOOK_DISPLAY_NAMES: Record<string, string> = {
  'genki_1_textbook': 'Genki I',
  'genki_2_textbook': 'Genki II',
  'quartet_1_textbook': 'Quartet 1',
  'quartet_2_textbook': 'Quartet 2',
  'authentic_japanese': 'Coming soon'
}

interface CEFRButtonProps {
  cefr: CEFRLevel
  title: string
  description: string
  baseTextbook: string
  lessonsCompleted: number
  totalLessons: number
  disabled?: boolean
  onClick: () => void
}

function CEFRButton({
  title,
  description,
  lessonsCompleted,
  totalLessons,
  disabled = false,
  onClick
}: CEFRButtonProps) {
  const percentage = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'Content not yet available' : undefined}
      className={`group relative flex flex-col gap-3 rounded-lg border-2 p-4 sm:p-6 text-left transition-all ${
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
          : 'border-slate-200 bg-white hover:border-blue-500 hover:shadow-lg'
      }`}
    >
      {/* CEFR Level Badge */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className={`text-xs font-bold text-slate-500 ${disabled ? '' : 'group-hover:text-blue-600'}`}>
          {disabled ? '—' : `${lessonsCompleted}/${totalLessons}`}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${disabled ? 0 : percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="text-xs text-slate-500">
        {disabled
          ? 'Coming soon'
          : lessonsCompleted === 0
            ? 'Not started'
            : lessonsCompleted === totalLessons
              ? '✓ Completed'
              : `${percentage}% complete`}
      </div>
    </button>
  )
}

interface LessonsHubProps {
  embedded?: boolean
}

interface LessonShortcut {
  cefr: CEFRLevel
  lessonNumber: number
  lessonId: string
  vocabCount: number
  grammarCount: number
  practiceCount: number
}

export function LessonsHub({ embedded = false }: LessonsHubProps) {
  const navigate = useNavigate()
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)
  const [lessonShortcuts, setLessonShortcuts] = useState<LessonShortcut[]>([])

  // CEFR levels — descriptions derived from CEFR_BASE_TEXTBOOK so labels stay in sync
  const TIERS: Record<CEFRLevel, string> = {
    a1: 'Beginner',
    a2: 'Elementary',
    b1: 'Intermediate',
    b2: 'Upper Intermediate',
    c1: 'Advanced'
  }

  const cefrLevels: Array<{
    cefr: CEFRLevel
    title: string
    description: string
  }> = (['a1', 'a2', 'b1', 'b2', 'c1'] as CEFRLevel[]).map(cefr => {
    const baseTextbook = CEFR_BASE_TEXTBOOK[cefr]
    const textbookName = TEXTBOOK_DISPLAY_NAMES[baseTextbook] ?? 'TBD'
    return {
      cefr,
      title: cefr.toUpperCase(),
      description: `${TIERS[cefr]} • ${textbookName}`
    }
  })

  // Calculate completion stats for each level
  const stats = useMemo(() => {
    const result: Record<CEFRLevel, { completed: number; total: number }> = {
      a1: { completed: 0, total: 0 },
      a2: { completed: 0, total: 0 },
      b1: { completed: 0, total: 0 },
      b2: { completed: 0, total: 0 },
      c1: { completed: 0, total: 0 }
    }

    cefrLevels.forEach(({ cefr }) => {
      const baseTextbook = CEFR_BASE_TEXTBOOK[cefr]
      const totalLessons = TEXTBOOK_LESSON_COUNTS[baseTextbook] || 0
      const completed = lessonsCompleted.filter(id => id.startsWith(baseTextbook.split('_').slice(0, -1).join('_'))).length

      result[cefr] = {
        total: totalLessons,
        completed
      }
    })

    return result
  }, [lessonsCompleted])

  const handleCEFRSelect = (cefr: CEFRLevel) => {
    // Navigate to first lesson for that CEFR level
    navigate(`/learn/lessons/${cefr}/1`)
  }

  const availableLessonCount = Object.values(stats).reduce((sum, entry) => sum + entry.total, 0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const summaries: LessonShortcut[] = []
      for (const cefr of ['a1', 'a2', 'b1', 'b2'] as CEFRLevel[]) {
        const baseTextbook = CEFR_BASE_TEXTBOOK[cefr]
        const total = TEXTBOOK_LESSON_COUNTS[baseTextbook] ?? 0
        const curriculum = await curriculumService.getTextbookCurriculum(baseTextbook)
        if (!curriculum || total === 0) continue

        const seriesPrefix = baseTextbook.split('_').slice(0, -1).join('_')
        for (let lessonNumber = 1; lessonNumber <= total; lessonNumber += 1) {
          const lessonId = `${seriesPrefix}_${lessonNumber}`
          const matchesLesson = createLessonMatcher(lessonId, lessonNumber)
          const rawVocab = curriculum.vocabulary.filter(item => matchesLesson(item.lesson))
          const rawGrammar = curriculum.grammar.filter(item => matchesLesson(item.lesson))
          const workbookPractice = await getWorkbookPracticeTasks({ cefr, lessonId, lessonNum: lessonNumber })
          summaries.push({
            cefr,
            lessonNumber,
            lessonId,
            vocabCount: rawVocab.length,
            grammarCount: rawGrammar.length,
            practiceCount: workbookPractice.length,
          })
        }
      }
      if (!cancelled) setLessonShortcuts(summaries)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const content = (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-6 sm:p-8'}>
      <div className={embedded ? '' : 'mx-auto max-w-4xl'}>
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-slate-900">Study by Lesson</h1>
              <p className="text-base sm:text-lg text-slate-600">
                Follow a structured curriculum organized by your proficiency level
              </p>
            </div>
            {!embedded && (
              <button
                onClick={() => navigate('/learn')}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm transition-colors hover:bg-indigo-100"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Return to Course
              </button>
            )}
          </div>
        </div>

        {/* Textbook Progress Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Textbook Progress</h2>
          <TextbookProgress />
        </div>

        {/* CEFR Level Grid */}
        {availableLessonCount === 0 ? (
          <EmptyState
            icon="📚"
            title="No lesson packs available"
            description="Import or generate a textbook pack, then return here to study by level."
          />
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cefrLevels.map(({ cefr, title, description }) => {
            const isDisabled = stats[cefr].total === 0
            return (
              <CEFRButton
                key={cefr}
                cefr={cefr}
                title={title}
                description={description}
                baseTextbook={CEFR_BASE_TEXTBOOK[cefr]}
                lessonsCompleted={stats[cefr].completed}
                totalLessons={stats[cefr].total}
                disabled={isDisabled}
                onClick={() => handleCEFRSelect(cefr)}
              />
            )
          })}
        </div>
        )}

        {lessonShortcuts.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Lesson Menu</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {cefrLevels.filter(({ cefr }) => stats[cefr].total > 0).map(({ cefr, title, description }) => {
                const lessons = lessonShortcuts.filter(lesson => lesson.cefr === cefr)
                if (lessons.length === 0) return null
                return (
                  <section key={cefr} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-950">{title}</h3>
                        <p className="text-xs font-medium text-slate-500">{description}</p>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{lessons.length}</span>
                    </div>
                    <div className="grid gap-2">
                      {lessons.map(lesson => (
                        <button
                          key={lesson.lessonId}
                          type="button"
                          onClick={() => navigate(`/learn/lessons/${lesson.cefr}/${lesson.lessonNumber}`)}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900">Lesson {lesson.lessonNumber}</span>
                            <span className={lessonsCompleted.includes(lesson.lessonId) ? 'text-xs font-bold text-emerald-700' : 'text-xs font-medium text-slate-500'}>
                              {lessonsCompleted.includes(lesson.lessonId) ? 'Completed' : 'Open'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-1">
                              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                              {lesson.vocabCount} vocab
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-1">
                              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                              {lesson.grammarCount} grammar
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-1">
                              <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />
                              {lesson.practiceCount} practice
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}

        {/* Information Section */}
        <div className="mt-12 grid gap-4 sm:gap-8 md:grid-cols-2">
          <div className="rounded-lg bg-blue-50 p-6">
            <h3 className="mb-2 font-semibold text-blue-900">How it works</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>1. Select your proficiency level (A1-C1)</li>
              <li>2. Work through lessons in order</li>
              <li>3. Learn vocabulary and grammar for each lesson</li>
              <li>4. Study matching Anki cards to reinforce</li>
              <li>5. Track your progress</li>
            </ul>
          </div>

          <div className="rounded-lg bg-green-50 p-6">
            <h3 className="mb-2 font-semibold text-green-900">About levels</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li><strong>A1:</strong> Complete beginner</li>
              <li><strong>A2:</strong> Elementary proficiency</li>
              <li><strong>B1:</strong> Intermediate level</li>
              <li><strong>B2:</strong> Upper intermediate</li>
              <li><strong>C1:</strong> Advanced level</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  if (embedded) return content

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      {content}
    </div>
  )
}
