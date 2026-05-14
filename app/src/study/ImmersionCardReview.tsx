import { useState } from 'react'
import type { ReviewCard } from './types'
import type { Rating } from '../core/providers'

interface ImmersionCardReviewProps {
  card: ReviewCard
  phase: 'front' | 'back'
  onReveal: () => void
  onRate: (rating: Rating) => Promise<void>
  nextQueuePreview: string[]
}

export function ImmersionCardReview({
  card,
  phase,
  onReveal,
  onRate,
  nextQueuePreview,
}: ImmersionCardReviewProps) {
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [isRating, setIsRating] = useState(false)

  const playAudio = () => {
    if (!card.audioUrl) return
    setAudioPlaying(true)
    const audio = new Audio(card.audioUrl)
    audio.onended = () => setAudioPlaying(false)
    audio.play().catch(() => setAudioPlaying(false))
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">
      {/* Replay badge */}
      {card.isReplay && (
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
            🔄 Review
          </span>
        </div>
      )}

      {/* Main card display */}
      <div className="rounded-2xl bg-white border border-gray-100 p-8 shadow-sm">
        <div className="flex flex-col gap-6 items-center min-h-64 justify-center">
          {/* Front side */}
          {phase === 'front' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
                {card.type === 'grammar' ? 'Grammar Pattern' : 'Card Front'}
              </p>

              <div className="space-y-2">
                <p className="text-5xl font-bold text-gray-900" lang="ja">
                  {card.front}
                </p>

                {card.reading && (
                  <p className="text-lg text-gray-600">
                    {card.reading}
                  </p>
                )}
              </div>

              {card.audioUrl && (
                <button
                  onClick={playAudio}
                  disabled={audioPlaying}
                  className="mx-auto px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {audioPlaying ? '♫ Playing...' : '♫ Play audio'}
                </button>
              )}

              <button
                onClick={onReveal}
                className="mt-6 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                Show Answer
              </button>
            </div>
          )}

          {/* Back side */}
          {phase === 'back' && (
            <div className="text-center space-y-6 w-full">
              {/* Front reminder */}
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Original card</p>
                <p className="text-2xl font-bold text-gray-900" lang="ja">
                  {card.front}
                </p>
                {card.reading && (
                  <p className="text-gray-600 mt-1">{card.reading}</p>
                )}
              </div>

              {/* Answer */}
              <div className="space-y-2">
                <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">
                  Answer
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {card.back}
                </p>
              </div>

              {/* Rating grid */}
              <div className="grid grid-cols-4 gap-2 mt-8">
                <button
                  onClick={async () => {
                    setIsRating(true)
                    await onRate('again').catch(console.error)
                    setIsRating(false)
                  }}
                  disabled={isRating}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-red-300 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <span className="text-lg">❌</span>
                  <span className="text-xs font-semibold text-red-700">Again</span>
                </button>
                <button
                  onClick={async () => {
                    setIsRating(true)
                    await onRate('hard').catch(console.error)
                    setIsRating(false)
                  }}
                  disabled={isRating}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-50"
                >
                  <span className="text-lg">😤</span>
                  <span className="text-xs font-semibold text-orange-700">Hard</span>
                </button>
                <button
                  onClick={async () => {
                    setIsRating(true)
                    await onRate('good').catch(console.error)
                    setIsRating(false)
                  }}
                  disabled={isRating}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <span className="text-lg">👍</span>
                  <span className="text-xs font-semibold text-blue-700">Good</span>
                </button>
                <button
                  onClick={async () => {
                    setIsRating(true)
                    await onRate('easy').catch(console.error)
                    setIsRating(false)
                  }}
                  disabled={isRating}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-green-300 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <span className="text-lg">🎉</span>
                  <span className="text-xs font-semibold text-green-700">Easy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next queue preview */}
      {nextQueuePreview.length > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
            Coming up
          </p>
          <div className="flex flex-wrap gap-2">
            {nextQueuePreview.map((preview, i) => (
              <span
                key={i}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  preview.startsWith('Review:')
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
              >
                {preview.replace('Review: ', '🔄 ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
