/**
 * Manual study-data backup: SQLite snapshot + lightweight app progress fields.
 * Highest-value recovery path until optional account sync exists.
 */
import { SQLiteStorage, exportSqliteSnapshot, replaceSqliteSnapshot } from '../db/sqlite'
import { useAppStore } from '../store'

export const STUDY_BACKUP_VERSION = 1 as const

export interface StudyBackupAppState {
  lessonsCompleted: string[]
  currentLesson: string | null
  dailyStats: {
    currentStreak: number
    longestStreak: number
    todayReviewed: number
  }
  learningPath: unknown
  settings: Record<string, unknown>
}

export interface StudyBackup {
  version: typeof STUDY_BACKUP_VERSION
  exportedAt: string
  sqliteBase64: string
  appState: StudyBackupAppState
}

function bytesToBase64(data: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function scrubSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const next = { ...settings }
  delete next.apiKey
  delete next.sessionToken
  return next
}

export async function buildStudyBackup(): Promise<StudyBackup> {
  const storage = new SQLiteStorage()
  await storage.flush()
  const snapshot = await exportSqliteSnapshot()
  const state = useAppStore.getState()
  return {
    version: STUDY_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sqliteBase64: bytesToBase64(snapshot),
    appState: {
      lessonsCompleted: [...state.lessonsCompleted],
      currentLesson: state.currentLesson,
      dailyStats: { ...state.dailyStats },
      learningPath: state.learningPath,
      settings: scrubSettings({ ...state.settings }),
    },
  }
}

export function downloadStudyBackup(backup: StudyBackup, filename?: string): void {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
  anchor.href = url
  anchor.download = filename ?? `kirokumichi-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function restoreStudyBackup(backup: StudyBackup): Promise<void> {
  if (!backup || backup.version !== STUDY_BACKUP_VERSION) {
    throw new Error('Unsupported backup version')
  }
  if (!backup.sqliteBase64 || typeof backup.sqliteBase64 !== 'string') {
    throw new Error('Backup is missing SQLite data')
  }

  const bytes = base64ToBytes(backup.sqliteBase64)
  await replaceSqliteSnapshot(bytes)

  const appState = backup.appState
  if (appState && typeof appState === 'object') {
    const store = useAppStore.getState()
    if (Array.isArray(appState.lessonsCompleted)) {
      useAppStore.setState({ lessonsCompleted: appState.lessonsCompleted.map(String) })
    }
    if ('currentLesson' in appState) {
      store.setCurrentLesson(typeof appState.currentLesson === 'string' ? appState.currentLesson : null)
    }
    if (appState.dailyStats && typeof appState.dailyStats === 'object') {
      store.setDailyStats({
        currentStreak: Number(appState.dailyStats.currentStreak) || 0,
        longestStreak: Number(appState.dailyStats.longestStreak) || 0,
        todayReviewed: Number(appState.dailyStats.todayReviewed) || 0,
      })
    }
    if ('learningPath' in appState) {
      store.setLearningPath((appState.learningPath as never) ?? null)
    }
    if (appState.settings && typeof appState.settings === 'object') {
      store.updateSettings(scrubSettings(appState.settings) as never)
    }
  }
}

export async function readStudyBackupFile(file: File): Promise<StudyBackup> {
  const text = await file.text()
  const parsed = JSON.parse(text) as StudyBackup
  if (!parsed || parsed.version !== STUDY_BACKUP_VERSION) {
    throw new Error('Not a KirokuMichi study backup (version 1)')
  }
  return parsed
}
