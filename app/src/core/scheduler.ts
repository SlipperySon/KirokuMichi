import { createEmptyCard, fsrs, generatorParameters, Rating as FSRSRating } from 'ts-fsrs'
import type { CardState, Rating, ScheduleResult, SchedulerProvider } from './providers'

const FSRS_RATING_MAP: Record<Rating, number> = {
  again: FSRSRating.Again,
  hard: FSRSRating.Hard,
  good: FSRSRating.Good,
  easy: FSRSRating.Easy,
}

export const LEECH_THRESHOLD = 8

function toCardState(card: any): CardState {
  const stateMap = ['new', 'learning', 'review', 'relearning'] as const
  return {
    due: card.due as Date,
    stability: card.stability as number,
    difficulty: card.difficulty as number,
    retrievability: 0,
    state: stateMap[(card.state as number) || 0] || 'new',
    reps: card.reps as number,
    lapses: card.lapses as number,
  }
}

export class FSRSScheduler implements SchedulerProvider {
  private f = fsrs(generatorParameters({ enable_fuzz: true }))

  getNewCard(): CardState {
    return toCardState(createEmptyCard())
  }

  schedule(card: CardState, rating: Rating): ScheduleResult {
    const stateMap = ['new', 'learning', 'review', 'relearning'] as const
    const stateIndex = stateMap.indexOf(card.state)
    const fsrsCard: any = {
      ...createEmptyCard(),
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      state: stateIndex >= 0 ? stateIndex : 0,
      reps: card.reps,
      lapses: card.lapses,
      last_review: new Date(),
    }

    const result = this.f.next(fsrsCard, new Date(), FSRS_RATING_MAP[rating])
    const scheduled: any = result.card

    const resultState: 'new' | 'learning' | 'review' | 'relearning' = stateMap[(scheduled.state as number) || 0] || 'new'
    const resultLapses = parseInt(String(scheduled.lapses), 10) || 0
    const retrievability = (this.f.get_retrievability(scheduled) as unknown as number | null) ?? 0
    return {
      due: scheduled.due as Date,
      stability: scheduled.stability as number,
      difficulty: scheduled.difficulty as number,
      retrievability,
      state: resultState,
      reps: scheduled.reps as number,
      lapses: resultLapses,
    }
  }
}

export class SM2Scheduler implements SchedulerProvider {
  getNewCard(): CardState {
    return {
      due: new Date(),
      stability: 1,
      difficulty: 2.5,
      retrievability: 0,
      state: 'new',
      reps: 0,
      lapses: 0,
    }
  }

  schedule(card: CardState, rating: Rating): ScheduleResult {
    const qualityMap: Record<Rating, number> = { again: 0, hard: 2, good: 4, easy: 5 }
    const q = qualityMap[rating]

    let ef = card.difficulty
    let interval = 1

    if (q >= 3) {
      if (card.reps === 0) interval = 1
      else if (card.reps === 1) interval = 6
      else interval = Math.round(card.stability * ef)

      ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      if (ef < 1.3) ef = 1.3
    } else {
      interval = 1
    }

    const due = new Date()
    due.setDate(due.getDate() + interval)

    return {
      due,
      stability: interval,
      difficulty: ef,
      retrievability: 0,
      state: q >= 3 ? 'review' : 'relearning',
      reps: q >= 3 ? card.reps + 1 : 0,
      lapses: q < 3 ? card.lapses + 1 : card.lapses,
    }
  }
}

export function isLeech(lapses: number): boolean {
  return lapses >= LEECH_THRESHOLD
}
