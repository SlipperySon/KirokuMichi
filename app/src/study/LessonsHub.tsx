/**
 * Lessons Hub - CEFR Level Selector
 * Main entry point for lesson-based studying
 * Users select their proficiency level (A1-C1) to access lessons
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { CEFR_BASE_TEXTBOOK, TEXTBOOK_LESSON_COUNTS, type CEFRLevel } from '../content/cefrMapping'

interface CEFRButtonProps {
  cefr: CEFRLevel
  title: string
  description: string
  baseTextbook: string
  lessonsCompleted: number
  totalLessons: number
  onClick: () => void
}

function CEFRButton({
  title,
  description,
  lessonsCompleted,
  totalLessons,
  onClick
}: CEFRButtonProps) {
  const percentage = totalLessons > 0 ? Math.round((lessonsCompleted / totalLessons) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-3 rounded-lg border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg"
    >
      {/* CEFR Level Badge */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="text-xs font-bold text-slate-500 group-hover:text-blue-600">
          {lessonsCompleted}/{totalLessons}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="text-xs text-slate-500">
        {lessonsCompleted === 0
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

  // CEFR levels and their descriptions
  const cefrLevels: Array<{
    cefr: CEFRLevel
    title: string
    description: string
  }> = [
    { cefr: 'a1', title: 'A1', description: 'Beginner • Genki I' },
    { cefr: 'a2', title: 'A2', description: 'Elementary • Genki II' },
    { cefr: 'b1', title: 'B1', description: 'Intermediate • Marugoto B1' },
    { cefr: 'b2', title: 'B2', description: 'Upper Intermediate • Quartet 2' },
    { cefr: 'c1', title: 'C1', description: 'Advanced • Tobira' }
  ]

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
          {cefrLevels.map(({ cefr, title, description }) => (
            <CEFRButton
              key={cefr}
              cefr={cefr}
              title={title}
              description={description}
              baseTextbook={CEFR_BASE_TEXTBOOK[cefr]}
              lessonsCompleted={stats[cefr].completed}
              totalLessons={stats[cefr].total}
              onClick={() => handleCEFRSelect(cefr)}
            />
          ))}
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
