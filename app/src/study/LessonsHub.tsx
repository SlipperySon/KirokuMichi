/**
 * Lessons Hub - CEFR Level Selector
 * Main entry point for lesson-based studying
 * Users select their proficiency level (A1-C1) to access lessons
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../content/cefrMapping'

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
      className={`group relative flex flex-col gap-3 rounded-lg border-2 p-6 text-left transition-all ${
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

export function LessonsHub() {
  const navigate = useNavigate()
  const lessonsCompleted = useAppStore(s => s.lessonsCompleted)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">Study by Lesson</h1>
          <p className="text-lg text-slate-600">
            Follow a structured curriculum organized by your proficiency level
          </p>
        </div>

        {/* CEFR Level Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

        {/* Information Section */}
        <div className="mt-12 grid gap-8 md:grid-cols-2">
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
}
