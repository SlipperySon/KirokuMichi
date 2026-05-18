import { CEFR_BASE_TEXTBOOK, type CEFRLevel } from './cefrMapping'
import type { GrammarItem, VocabItem } from './curriculumService'
import { formatTextbookName, pageRangeFromPages } from './lessonContentUtils'
import { hasMaynardSupport } from './maynardSupport'
import type { SupplementalScenario } from './supplementalScenarioService'
import type { WorkbookPracticeTask } from './workbookPracticeService'

export interface LessonIntent {
  objective: string
  prerequisite: string
  pageRange: string
  targetGrammar: string[]
  targetVocab: string[]
  outputSkill: string
  matchingScenarios: Array<{ id: string; title: string; source: string; page: number; canDo: string }>
  workbookPractice: WorkbookPracticeTask[]
  maynardMatchCount: number
}

function lessonStage(cefr: CEFRLevel) {
  if (cefr === 'a1') return 'short survival exchange'
  if (cefr === 'a2') return 'familiar everyday exchange'
  if (cefr === 'b1') return 'connected explanation or opinion'
  return 'extended discussion or reading-linked response'
}

function prerequisite(lessonNum: number, cefr: CEFRLevel) {
  if (cefr === 'a1' && lessonNum === 1) return 'Know hiragana/katakana shapes and be ready to say greetings and numbers out loud.'
  if (lessonNum === 1) return `Start of ${cefr.toUpperCase()}; review the previous level before moving quickly.`
  return `Complete ${cefr.toUpperCase()} Lesson ${lessonNum - 1} and be able to explain its main grammar in your own words.`
}

const A1_OUTPUT_SKILLS: Record<number, string> = {
  1: 'Greet someone, count basic numbers, and identify simple classroom objects politely.',
  2: 'Ask where people or things are and answer with basic location language.',
  3: 'Describe daily actions and simple likes/dislikes in short sentences.',
  4: 'Invite, permit, and talk about movement to places.',
  5: 'Explain simple reasons and talk about wants or plans.',
  6: 'Ask for help, describe changes, and talk about experiences.',
  7: 'Give advice, warnings, and simple comparisons.',
  8: 'Talk about plans, alternatives, and unfinished actions.',
  9: 'Describe people or things with clauses and report casual speech.',
  10: 'Talk about giving, receiving, preferences, and indefinite things.',
  11: 'Connect descriptions and narrate simple past events.',
  12: 'Use adjective and polite forms to explain why and ask follow-up questions.',
}

const A2_OUTPUT_SKILLS: Record<number, string> = {
  1: 'Ask what someone wants, compare choices, and explain what is easy or hard to use.',
  2: 'Describe first impressions, apologize for specific actions, and propose a repair.',
  3: 'State future intentions and give advice based on someone else’s plan.',
  4: 'Explain what is necessary, give multiple reasons, and describe a good past decision.',
  5: 'Report yes/no questions, describe prepared states, and talk about habits you are trying to keep.',
  6: 'Explain rules, exceptions, and accidental states using transitive/intransitive verb pairs.',
  7: 'Handle formal visits and offers using respectful and humble language.',
  8: 'Make backup plans and describe low-frequency or negative habits.',
  9: 'Describe cultural examples, report common views, and discuss corrections or redoing work.',
  10: 'Compare past and present habits and report common social beliefs with your own view.',
  11: 'Tell short connected stories with cause, sequence, and result.',
}

const B1_OUTPUT_SKILLS: Record<number, string> = {
  1: 'Give practical advice, report information, and explain how reliable it seems.',
  2: 'Explain goals, priorities, and what you keep doing even when conditions are difficult.',
  3: 'Discuss social topics with balanced opinions and connect experiences to outcomes.',
  4: 'Express nuanced reactions and compare benefits and limits of technology or habits.',
  5: 'Discuss trends without overgeneralizing and reflect on what you learned after trying something.',
  6: 'Describe social change, role shifts, and habits that are difficult to fix.',
}

const B2_OUTPUT_SKILLS: Record<number, string> = {
  1: 'Compare perspectives and describe returning to an activity after a long time.',
  2: 'Evaluate reputation, feasibility, and limitations in a realistic plan.',
  3: 'Explain responsibility, obligation, and situations where no good option remains.',
  4: 'Describe strong emotional reactions and urgent priorities under pressure.',
  5: 'Discuss problems with no easy fix and evaluate whether effort or reputation was deserved.',
  6: 'Explain what was learned through experience and why one responsible choice remains.',
}

function outputSkill(options: {
  cefr: CEFRLevel
  lessonNum: number
  scenarios: SupplementalScenario[]
}) {
  if (options.cefr === 'a1' && A1_OUTPUT_SKILLS[options.lessonNum]) return A1_OUTPUT_SKILLS[options.lessonNum]
  if (options.cefr === 'a2' && A2_OUTPUT_SKILLS[options.lessonNum]) return A2_OUTPUT_SKILLS[options.lessonNum]
  if (options.cefr === 'b1' && B1_OUTPUT_SKILLS[options.lessonNum]) return B1_OUTPUT_SKILLS[options.lessonNum]
  if (options.cefr === 'b2' && B2_OUTPUT_SKILLS[options.lessonNum]) return B2_OUTPUT_SKILLS[options.lessonNum]
  return options.scenarios[0]?.canDo ?? `Complete a ${lessonStage(options.cefr)} using this lesson's grammar and vocabulary.`
}

function objective(cefr: CEFRLevel, lessonNum: number, textbookName: string) {
  if (cefr === 'a1' && lessonNum === 1) {
    return 'Build the first survival layer: greetings, numbers, polite identification, and simple “what is this?” questions.'
  }
  if (cefr === 'a2') {
    return `Use ${textbookName} Lesson ${lessonNum} material to move from simple survival Japanese into connected everyday explanation.`
  }
  if (cefr === 'b1') {
    return `Use ${textbookName} Lesson ${lessonNum} material to build supported opinions, explanations, and short discussion turns.`
  }
  if (cefr === 'b2') {
    return `Use ${textbookName} Lesson ${lessonNum} material to handle nuanced discussion with evidence, stance, and qualification.`
  }
  return `Use ${textbookName} Lesson ${lessonNum} material to handle a ${lessonStage(cefr)}.`
}

export function buildLessonIntent(options: {
  cefr: CEFRLevel
  lessonNum: number
  lessonId: string
  vocab: VocabItem[]
  grammar: GrammarItem[]
  scenarios: SupplementalScenario[]
  workbookPractice: WorkbookPracticeTask[]
}): LessonIntent {
  const targetGrammar = options.grammar.slice(0, 6).map(item => item.pattern)
  const targetVocab = options.vocab.slice(0, 8).map(item => item.surface)
  const pages = [
    ...options.vocab.map(item => item.page),
    ...options.grammar.map(item => item.page),
    ...options.workbookPractice.map(item => item.page),
  ]
  const textbookName = formatTextbookName(CEFR_BASE_TEXTBOOK[options.cefr])
  const lessonOutputSkill = outputSkill(options)

  return {
    objective: objective(options.cefr, options.lessonNum, textbookName),
    prerequisite: prerequisite(options.lessonNum, options.cefr),
    pageRange: pageRangeFromPages(pages),
    targetGrammar,
    targetVocab,
    outputSkill: lessonOutputSkill,
    matchingScenarios: options.scenarios.slice(0, 4).map(scenario => ({
      id: scenario.id,
      title: scenario.title,
      source: scenario.textbook,
      page: scenario.page,
      canDo: scenario.canDo,
    })),
    workbookPractice: options.workbookPractice,
    maynardMatchCount: options.grammar.filter(hasMaynardSupport).length,
  }
}
