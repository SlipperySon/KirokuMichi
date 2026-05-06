import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jlptLevel: text('jlpt_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }).notNull().default('N5'),
  cefrLevel: text('cefr_level', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }).notNull().default('A1'),
  goalLevel: text('goal_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }),
  cefrGoalLevel: text('cefr_goal_level', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }),
  goalDate: text('goal_date'),
  studyMode: text('study_mode', { enum: ['standard', 'immersion'] }).notNull().default('standard'),
  hoverDelayMs: integer('hover_delay_ms').notNull().default(2000),
  hiraganaComplete: integer('hiragana_complete', { mode: 'boolean' }).notNull().default(false),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['vocabulary', 'kanji', 'grammar', 'hiragana', 'katakana'] }).notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  reading: text('reading'),
  jlptLevel: text('jlpt_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }),
  cefrLevel: text('cefr_level', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }),
  frequencyRank: integer('frequency_rank'),
  domain: text('domain'),
  audioUrl: text('audio_url'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('cards_jlpt_idx').on(t.jlptLevel),
  index('cards_cefr_idx').on(t.cefrLevel),
  index('cards_frequency_idx').on(t.frequencyRank),
])

export const cardStates = sqliteTable('card_states', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: integer('card_id').notNull().references(() => cards.id),
  userId: integer('user_id').notNull().references(() => users.id),
  due: text('due').notNull().default(sql`(datetime('now'))`),
  stability: real('stability').notNull().default(0),
  difficulty: real('difficulty').notNull().default(0),
  retrievability: real('retrievability').notNull().default(0),
  state: text('state', { enum: ['new', 'learning', 'review', 'relearning'] }).notNull().default('new'),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  leechCount: integer('leech_count').notNull().default(0),
  isLeech: integer('is_leech', { mode: 'boolean' }).notNull().default(false),
  lastReview: text('last_review'),
}, (t) => [
  index('card_states_due_idx').on(t.due),
  index('card_states_user_idx').on(t.userId),
])

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  mode: text('mode', { enum: ['srs', 'grammar', 'quiz', 'listening', 'writing', 'conversation', 'immersion'] }).notNull(),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  cardsReviewed: integer('cards_reviewed').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  endedAt: text('ended_at'),
})

export const mistakeLogs = sqliteTable('mistake_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  cardId: integer('card_id').references(() => cards.id),
  grammarPointId: integer('grammar_point_id'),
  userInput: text('user_input'),
  correctAnswer: text('correct_answer').notNull(),
  sessionId: integer('session_id').references(() => sessions.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('mistake_logs_user_idx').on(t.userId),
  index('mistake_logs_grammar_idx').on(t.grammarPointId),
])

export const weakPointSummaries = sqliteTable('weak_point_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  summary: text('summary').notNull(),
  stalenessAt: text('staleness_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('weak_point_user_idx').on(t.userId),
])

export const assessments = sqliteTable('assessments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['placement', 'reassessment'] }).notNull(),
  questionsJson: text('questions_json').notNull(),
  answersJson: text('answers_json').notNull(),
  resultLevel: text('result_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }),
  aiBreakdown: text('ai_breakdown'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const dailySchedules = sqliteTable('daily_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  blocksJson: text('blocks_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('settings_user_key_idx').on(t.userId, t.key),
])

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  payload: text('payload'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('events_type_idx').on(t.eventType),
  index('events_user_idx').on(t.userId),
])

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grammarPointId: integer('grammar_point_id'),
  jlptLevel: text('jlpt_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }),
  cefrLevel: text('cefr_level', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }),
  questionType: text('question_type', { enum: ['multiple_choice', 'fill_blank', 'listening', 'reading'] }).notNull(),
  prompt: text('prompt').notNull(),
  optionsJson: text('options_json'),
  answer: text('answer').notNull(),
  explanation: text('explanation'),
  source: text('source', { enum: ['pregenerated', 'community', 'user'] }).notNull().default('pregenerated'),
  qualityScore: real('quality_score'),
  confidence: real('confidence'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('questions_jlpt_idx').on(t.jlptLevel),
  index('questions_cefr_idx').on(t.cefrLevel),
  index('questions_grammar_idx').on(t.grammarPointId),
])

export const grammarDependencies = sqliteTable('grammar_dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grammarPointId: integer('grammar_point_id').notNull(),
  prerequisiteId: integer('prerequisite_id').notNull(),
  jlptLevel: text('jlpt_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }).notNull(),
})

export const promptTemplates = sqliteTable('prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateKey: text('template_key').notNull(),
  version: integer('version').notNull(),
  templateContent: text('template_content').notNull(),
  effectiveDate: text('effective_date').notNull().default(sql`(datetime('now'))`),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (t) => [
  index('prompt_templates_key_idx').on(t.templateKey),
])

export const grammarPoints = sqliteTable('grammar_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jlptLevel: text('jlpt_level', { enum: ['N5', 'N4', 'N3', 'N2', 'N1'] }),
  cefrLevel: text('cefr_level', { enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }),
  title: text('title').notNull(),
  pattern: text('pattern').notNull(),
  meaning: text('meaning').notNull(),
  explanation: text('explanation').notNull(),
  examplesJson: text('examples_json').notNull(),
  category: text('category'),
  isKeigo: integer('is_keigo', { mode: 'boolean' }).notNull().default(false),
  frequencyRank: integer('frequency_rank'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('grammar_jlpt_idx').on(t.jlptLevel),
  index('grammar_cefr_idx').on(t.cefrLevel),
  index('grammar_keigo_idx').on(t.isKeigo),
])

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportedBy: integer('reported_by').references(() => users.id),
  targetType: text('target_type', { enum: ['question', 'content'] }).notNull(),
  targetId: integer('target_id').notNull(),
  reason: text('reason'),
  status: text('status', { enum: ['pending', 'reviewed', 'resolved'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const learningContent = sqliteTable('learning_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  contentType: text('content_type', { enum: ['text_passage', 'word_list', 'grammar_point', 'sentence_pair', 'dialogue_script', 'unknown'] }).notNull().default('text_passage'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  translation: text('translation'),
  sequence: integer('sequence').notNull().default(0),
  sourceDocument: text('source_document'),
  jlptLevel: text('jlpt_level'),
  lastSeenAt: text('last_seen_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('learning_content_user_idx').on(t.userId),
  index('learning_content_type_idx').on(t.contentType),
  index('learning_content_source_idx').on(t.sourceDocument),
])
