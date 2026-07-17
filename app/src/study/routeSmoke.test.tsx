import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { APP_ROUTE_PATHS } from '../appRoutes'
import { messages } from '../i18n'
import { LessonsHub } from './LessonsHub'
import { LessonStudy } from './LessonStudy'

function renderAppSurface(ui: ReactNode) {
  return render(
    <IntlProvider locale="en" messages={messages.en}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </IntlProvider>
  )
}

describe('route smoke tests', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps critical learning routes registered', () => {
    expect(APP_ROUTE_PATHS).toEqual(expect.arrayContaining([
      '/study',
      '/study/srs',
      '/study/review',
      '/study/mistakes',
      '/learn',
      '/learn/lessons',
      '/learn/lessons/:cefr/:lessonNumber',
      '/learn/study',
      '/practice',
      '/scenarios',
      '/study/grammar',
      '/dev/textbook-qa',
    ]))
  })

  it('keeps all high-priority learner smoke routes in the route manifest', () => {
    expect(APP_ROUTE_PATHS).toEqual(expect.arrayContaining([
      '/study',
      '/study/srs',
      '/learn',
      '/learn/lessons',
      '/learn/lessons/:cefr/:lessonNumber',
      '/scenarios',
      '/practice',
      '/study/grammar',
      '/study/mistakes',
    ]))
  })

  it('renders the lesson menu surface', () => {
    renderAppSurface(<LessonsHub />)

    expect(screen.getByRole('heading', { name: 'Study by Lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Return to Course/i })).toBeInTheDocument()
  })

  it('renders the lesson study flow when route state is present', () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/learn/study',
          state: {
            vocab: [{ id: 'v1', surface: '学生', english: 'student', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 32 }],
            grammar: [{ id: 'g1', pattern: 'です', meaning: 'polite to be', lesson: 'genki_1_1', source: 'genki_1_textbook', page: 34 }],
            lessonId: 'genki_1_1',
            lessonTitle: 'Genki I - Lesson 1',
            cefrLevel: 'a1',
          },
        }]}
      >
        <LessonStudy />
      </MemoryRouter>
    )

    expect(screen.getByText('Step 1: Predict')).toBeInTheDocument()
    expect(screen.getByText('Reveal Teaching')).toBeInTheDocument()
  })
})
