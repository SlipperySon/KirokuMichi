import { describe, it, expect, vi } from 'vitest'
import { SRSService } from './srsService'
import { LEECH_THRESHOLD } from '../core/scheduler'
import type { StorageProvider, SchedulerProvider, CardState, ScheduleResult } from '../core/providers'

function makeStorage(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    query: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeScheduler(overrides: Partial<SchedulerProvider> = {}): SchedulerProvider {
  return {
    getNewCard: vi.fn().mockReturnValue({
      due: new Date(), stability: 0, difficulty: 0, retrievability: 0,
      state: 'new', reps: 0, lapses: 0,
    }),
    schedule: vi.fn().mockReturnValue({
      due: new Date(Date.now() + 86400000),
      stability: 1, difficulty: 2.5, retrievability: 0.9,
      state: 'review', reps: 1, lapses: 0,
    } satisfies ScheduleResult),
    ...overrides,
  }
}

const USER_ID = 1

describe('SRSService.getDueCards', () => {
  it('queries with is_leech=0 filter and returns mapped rows', async () => {
    const mockCards = [{ cardStateId: 1, cardId: 10, state: 'review', lapses: 0, stability: 1, difficulty: 2.5, due: '2026-01-01', type: 'vocabulary', front: 'こんにちは', back: 'Hello', reading: null, audioUrl: null, jlptLevel: 'N5' }]
    const storage = makeStorage({ query: vi.fn().mockResolvedValue(mockCards) })
    const svc = new SRSService(storage, makeScheduler())

    const result = await svc.getDueCards(USER_ID, 20)

    expect(result).toEqual(mockCards)
    expect(storage.query).toHaveBeenCalledWith(
      expect.stringContaining('is_leech = 0'),
      [USER_ID, 20]
    )
  })
})

describe('SRSService.getNewCards', () => {
  it('filters by state=new and orders by frequency_rank', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([]) })
    const svc = new SRSService(storage, makeScheduler())

    await svc.getNewCards(USER_ID, 10)

    const [sql] = (storage.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("state = 'new'")
    expect(sql).toContain('frequency_rank ASC')
  })
})

describe('SRSService.getCardsForLesson', () => {
  it('queries Genki II lessons with app and source lesson ids', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([]) })
    const svc = new SRSService(storage, makeScheduler())

    await svc.getCardsForLesson(USER_ID, 'genki_2_1', 20)

    const [sql, params] = (storage.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('cs.lesson_id IN (?, ?)')
    expect(params).toEqual([USER_ID, 'genki_2_1', 'genki_2_13', 20])
  })

  it('keeps Genki I lesson queries exact', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([]) })
    const svc = new SRSService(storage, makeScheduler())

    await svc.getCardsForLesson(USER_ID, 'genki_1_1')

    const [sql, params] = (storage.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('cs.lesson_id IN (?)')
    expect(params).toEqual([USER_ID, 'genki_1_1'])
  })
})

describe('SRSService.reviewCard', () => {
  function makeRowStorage(lapses: number, isLeech = 0) {
    let callCount = 0
    return makeStorage({
      query: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve([{
            due: new Date().toISOString(), stability: 1, difficulty: 2.5,
            retrievability: 0.9, state: 'review', reps: 1, lapses, is_leech: isLeech,
          }])
        }
        return Promise.resolve([{ id: 99 }])
      }),
    })
  }

  it('calls scheduler.schedule and executes UPDATE', async () => {
    const storage = makeRowStorage(0)
    const scheduler = makeScheduler()
    const svc = new SRSService(storage, scheduler)

    await svc.reviewCard(USER_ID, 1, 'good')

    expect(scheduler.schedule).toHaveBeenCalledOnce()
    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE card_states'),
      expect.any(Array)
    )
  })

  it('returns isNewLeech=true when lapses cross LEECH_THRESHOLD', async () => {
    const storage = makeRowStorage(LEECH_THRESHOLD - 1, 0)
    const scheduler = makeScheduler({
      schedule: vi.fn().mockReturnValue({
        due: new Date(), stability: 0, difficulty: 0, retrievability: 0,
        state: 'relearning', reps: 0, lapses: LEECH_THRESHOLD,
      }),
    })
    const svc = new SRSService(storage, scheduler)

    const { isNewLeech } = await svc.reviewCard(USER_ID, 1, 'again')
    expect(isNewLeech).toBe(true)
  })

  it('returns isNewLeech=false when already a leech', async () => {
    const storage = makeRowStorage(LEECH_THRESHOLD, 1)
    const scheduler = makeScheduler({
      schedule: vi.fn().mockReturnValue({
        due: new Date(), stability: 0, difficulty: 0, retrievability: 0,
        state: 'relearning', reps: 0, lapses: LEECH_THRESHOLD + 1,
      }),
    })
    const svc = new SRSService(storage, scheduler)

    const { isNewLeech } = await svc.reviewCard(USER_ID, 1, 'again')
    expect(isNewLeech).toBe(false)
  })
})

describe('SRSService grammar scheduling', () => {
  it('seeds grammar_states before querying due grammar', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([]) })
    const svc = new SRSService(storage, makeScheduler())

    await svc.getGrammarQueue(USER_ID, 10)

    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO grammar_states'),
      expect.any(Array)
    )
    expect(storage.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM grammar_points gp'),
      [USER_ID, 10]
    )
  })

  it('reviews grammar through the scheduler and updates progress history', async () => {
    let queryCount = 0
    const storage = makeStorage({
      query: vi.fn().mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve([{
            grammar_point_id: 7,
            due: new Date().toISOString(),
            stability: 1,
            difficulty: 2.5,
            retrievability: 0,
            state: 'new',
            reps: 0,
            lapses: 0,
            is_leech: 0,
          }])
        }
        return Promise.resolve([])
      }),
    })
    const scheduler = makeScheduler()
    const svc = new SRSService(storage, scheduler)

    await svc.reviewGrammar(USER_ID, 99, 'good')

    expect(scheduler.schedule).toHaveBeenCalledOnce()
    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE grammar_states'),
      expect.any(Array)
    )
    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO grammar_progress'),
      [USER_ID, 7]
    )
  })
})

describe('SRSService.suspendCard', () => {
  it('executes UPDATE with is_leech=1', async () => {
    const storage = makeStorage()
    const svc = new SRSService(storage, makeScheduler())

    await svc.suspendCard(USER_ID, 5)

    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('is_leech = 1'),
      [5, USER_ID]
    )
  })
})

describe('SRSService.endSession', () => {
  it('updates ended_at and stats', async () => {
    const storage = makeStorage()
    const svc = new SRSService(storage, makeScheduler())

    await svc.endSession(99, { cardsReviewed: 20, correctCount: 15, startedAt: Date.now() - 300000 })

    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('ended_at'),
      expect.arrayContaining([20, 15, 99])
    )
  })
})

describe('SRSService.logMistake', () => {
  it('inserts into mistake_logs with all fields', async () => {
    const storage = makeStorage()
    const svc = new SRSService(storage, makeScheduler())

    await svc.logMistake(USER_ID, 10, 'wrong', 'correct', 99)

    expect(storage.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO mistake_logs'),
      [USER_ID, 10, 'wrong', 'correct', 99]
    )
  })
})

describe('SRSService.getStreakData', () => {
  it('fills zero-count days for missing dates', async () => {
    const storage = makeStorage({
      query: vi.fn().mockResolvedValue([
        { date: new Date().toISOString().split('T')[0], cardsReviewed: 10, sessionCount: 1 },
      ]),
    })
    const svc = new SRSService(storage, makeScheduler())

    const streak = await svc.getStreakData(USER_ID)

    expect(streak.days).toHaveLength(84)
    expect(streak.days.filter(d => d.cardsReviewed > 0)).toHaveLength(1)
  })

  it('computes currentStreak=1 when only today has cards', async () => {
    const today = new Date().toISOString().split('T')[0]
    const storage = makeStorage({
      query: vi.fn().mockResolvedValue([{ date: today, cardsReviewed: 5, sessionCount: 1 }]),
    })
    const svc = new SRSService(storage, makeScheduler())

    const streak = await svc.getStreakData(USER_ID)
    expect(streak.currentStreak).toBe(1)
  })

  it('returns currentStreak=0 when no sessions today', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([]) })
    const svc = new SRSService(storage, makeScheduler())

    const streak = await svc.getStreakData(USER_ID)
    expect(streak.currentStreak).toBe(0)
  })
})

describe('SRSService.getIntervalPreviews', () => {
  it('returns previews for all 4 ratings', () => {
    const svc = new SRSService(makeStorage(), makeScheduler())
    const cardState: CardState = {
      due: new Date(), stability: 1, difficulty: 2.5, retrievability: 0.9,
      state: 'review', reps: 1, lapses: 0,
    }

    const previews = svc.getIntervalPreviews(cardState)

    expect(previews).toHaveProperty('again')
    expect(previews).toHaveProperty('hard')
    expect(previews).toHaveProperty('good')
    expect(previews).toHaveProperty('easy')
  })
})

describe('SRSService.getLearnedCardIds', () => {
  it('queries with reps > 0 filter', async () => {
    const storage = makeStorage({ query: vi.fn().mockResolvedValue([{ card_id: 1 }, { card_id: 2 }]) })
    const svc = new SRSService(storage, makeScheduler())

    const ids = await svc.getLearnedCardIds(USER_ID)

    expect(ids).toEqual([1, 2])
    expect(storage.query).toHaveBeenCalledWith(
      expect.stringContaining('reps > 0'),
      [USER_ID]
    )
  })
})
