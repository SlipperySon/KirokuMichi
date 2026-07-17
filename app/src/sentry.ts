import * as Sentry from '@sentry/react'

const env = import.meta.env as ImportMetaEnv & {
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_ENVIRONMENT?: string
  VITE_SENTRY_RELEASE?: string
}

if (env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    release: env.VITE_SENTRY_RELEASE || env.VITE_GIT_COMMIT || env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
  })
}
