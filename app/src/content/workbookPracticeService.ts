import { CEFR_SUPPLEMENTAL, type CEFRLevel } from './cefrMapping'
import { curriculumService, type Exercise } from './curriculumService'
import { createLessonMatcher, formatTextbookName } from './lessonContentUtils'
import { getSupplementalScenarios } from './supplementalScenarioService'

export interface WorkbookPracticeTask {
  id: string
  source: string
  sourceKey: string
  page: number
  type: 'guided_drill' | 'short_answer' | 'roleplay' | 'correction_target' | 'checkpoint_question'
  practiceMode: 'guided' | 'output' | 'correction' | 'checkpoint'
  focus: string
  prompt: string
  sourcePrompt?: string
  support: string
}

function taskType(exercise: Exercise, index: number): WorkbookPracticeTask['type'] {
  const prompt = exercise.question
  if (/会話|ロール|ペア|話/.test(prompt)) return 'roleplay'
  if (/直|正し|まちが|誤/.test(prompt)) return 'correction_target'
  if (/質問|答|聞/.test(prompt)) return 'short_answer'
  if (index % 4 === 0) return 'checkpoint_question'
  return 'guided_drill'
}

function supportFor(type: WorkbookPracticeTask['type']) {
  switch (type) {
    case 'roleplay':
      return 'Answer once as yourself, then switch roles and ask one follow-up question.'
    case 'correction_target':
      return 'Fix the sentence, then explain which grammar clue made the correction necessary.'
    case 'short_answer':
      return 'Write or say a one-sentence answer before checking model language.'
    case 'checkpoint_question':
      return 'Use this as a quick lesson checkpoint after the teaching cards.'
    default:
      return 'Do the prompt out loud first, then write one clean version.'
  }
}

function practiceModeFor(type: WorkbookPracticeTask['type']): WorkbookPracticeTask['practiceMode'] {
  if (type === 'roleplay' || type === 'short_answer') return 'output'
  if (type === 'correction_target') return 'correction'
  if (type === 'checkpoint_question') return 'checkpoint'
  return 'guided'
}

function focusFor(prompt: string, type: WorkbookPracticeTask['type']) {
  if (/会話|ロール|ペア|話|相談|意見/.test(prompt)) return 'spoken output'
  if (/直|正し|まちが|誤/.test(prompt)) return 'error correction'
  if (/質問|答|聞/.test(prompt)) return 'short response'
  if (/文を作|作文|書いて/.test(prompt)) return 'sentence production'
  if (type === 'checkpoint_question') return 'checkpoint recall'
  return 'guided form practice'
}

function cleanPrompt(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

const TOO_GENERIC_PROMPT_RE =
  /(日本語で答えて|日本語で書いて|答えてください|書いてください|文を完成|会話を完成|の言葉を使って|質問に答え|Answer the questions|Complete the sentences)/i
const BROKEN_FRAGMENT_RE =
  /^(?:う|を|で|に|は|が|ので|から|そして|その後|また|ただし|必要なら|同じ言葉|[A-Z]：|[0-9]+[.)、])/

const BAD_WORKBOOK_PROMPT_RE =
  /(ワークブック|テキスト|第[123]版|改訂|制作|補助教材|練習カード|各課には|まずは文字|加筆修正|ページのワーク|はじめに|目次|凡例|著作権|出版|文法項目|読み書き編|構成されています|必要に応じて|取り組む|学習した後|聞く練習|漢字の練習|KanjiPractice|Kanj|Listening Comprehension|copyright|isbn|audio|script|answer key|contents|introduction|publisher)/i
const WORKBOOK_TASK_RE = /(会話|ロール|ペア|話|質問|答|聞|書いて|説明|紹介|相談|意見|直|正し|まちが|誤|完成|文を作|作文|練習|ください|ましょう)/i
const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/g
const ENGLISH_RE = /[A-Za-z]/g

function charRatio(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length / Math.max(1, text.length)
}

export function isUsableWorkbookExercise(exercise: Exercise) {
  const prompt = cleanPrompt(exercise.question)
  if (exercise.page > 0 && exercise.page < 10) return false
  if (prompt.length < 8 || prompt.length > 180) return false
  if (BAD_WORKBOOK_PROMPT_RE.test(prompt)) return false
  if (BROKEN_FRAGMENT_RE.test(prompt) && !TOO_GENERIC_PROMPT_RE.test(prompt)) return false
  if (!WORKBOOK_TASK_RE.test(prompt)) return false
  if (charRatio(prompt, JAPANESE_RE) < 0.12 && charRatio(prompt, ENGLISH_RE) < 0.12) return false
  if (/[{}[\]\\<>|]{2,}|[A-Za-z]{18,}|\d{4,}/.test(prompt)) return false
  return true
}

function lessonLabel(cefr: CEFRLevel, lessonNum: number) {
  return `${cefr.toUpperCase()} Lesson ${lessonNum}`
}

export function normalizeWorkbookPracticePrompt(prompt: string, options: {
  cefr: CEFRLevel
  lessonNum: number
  type: WorkbookPracticeTask['type']
}) {
  const cleaned = cleanPrompt(prompt)
  const label = lessonLabel(options.cefr, options.lessonNum)

  if (/日本語で答えて|答えてください|Answer the questions|質問に答え/i.test(cleaned)) {
    return `Answer the workbook questions in Japanese, then add one original ${label} sentence of your own.`
  }

  if (/日本語で書いて|書いてください|作文/i.test(cleaned)) {
    return `Write two original Japanese sentences for ${label}, then read them aloud and check particles and verb endings.`
  }

  if (/会話を完成|会話/.test(cleaned)) {
    return `Complete the workbook conversation, then roleplay it once and add one natural follow-up line.`
  }

  if (/文を完成|Complete the sentences|の言葉を使って|完成させ/.test(cleaned)) {
    return `Complete the workbook sentences, then explain which grammar clue told you the missing form.`
  }

  if (options.type === 'correction_target' && /正し|直|まちが|誤/.test(cleaned)) {
    return `Correct the workbook sentences, then name the grammar or particle that changed.`
  }

  return cleaned
}

function scenarioPracticePrompt(scenario: Awaited<ReturnType<typeof getSupplementalScenarios>>[number]) {
  if (scenario.sourceKind === 'dialogue') {
    return scenario.practicePrompts[1] || scenario.canDo
  }

  const prompt = cleanPrompt(scenario.practicePrompts[0] || '')
  if (!prompt || /example below|read the model exchange|corresponding lesson/i.test(prompt)) {
    return scenario.canDo
  }
  return prompt
}

export async function getWorkbookPracticeTasks(options: {
  cefr: CEFRLevel
  lessonId: string
  lessonNum: number
  limit?: number
}): Promise<WorkbookPracticeTask[]> {
  const matchLesson = createLessonMatcher(options.lessonId, options.lessonNum)
  const workbookKeys = CEFR_SUPPLEMENTAL[options.cefr].filter(key => /workbook/.test(key))
  const tasks: WorkbookPracticeTask[] = []

  for (const sourceKey of workbookKeys) {
    const curriculum = await curriculumService.getTextbookCurriculum(sourceKey)
    const exercises = curriculum?.exercises
      .filter(exercise => matchLesson(exercise.lesson))
      .filter(isUsableWorkbookExercise) ?? []
    exercises.slice(0, 8).forEach((exercise, index) => {
      const type = taskType(exercise, index)
      const sourcePrompt = cleanPrompt(exercise.question)
      const prompt = normalizeWorkbookPracticePrompt(sourcePrompt, {
        cefr: options.cefr,
        lessonNum: options.lessonNum,
        type,
      })
      tasks.push({
        id: `${sourceKey}:${exercise.id}`,
        source: formatTextbookName(sourceKey),
        sourceKey,
        page: exercise.page,
        type,
        practiceMode: practiceModeFor(type),
        focus: focusFor(prompt, type),
        prompt,
        sourcePrompt: prompt === sourcePrompt ? undefined : sourcePrompt,
        support: supportFor(type),
      })
    })
  }

  const scenarios = await getSupplementalScenarios({ cefr: options.cefr, coreLessonId: options.lessonId })
  scenarios.slice(0, 4).forEach(scenario => {
    const prompt = scenarioPracticePrompt(scenario)
    tasks.push({
      id: `scenario:${scenario.id}`,
      source: scenario.textbook,
      sourceKey: scenario.textbookKey,
      page: scenario.page,
      type: scenario.sourceKind === 'dialogue' ? 'roleplay' : 'short_answer',
      practiceMode: 'output',
      focus: scenario.sourceKind === 'dialogue' ? 'spoken output' : 'short response',
      prompt,
      sourcePrompt: scenario.sourceKind !== 'curated' && prompt !== scenario.practicePrompts[0]
        ? scenario.practicePrompts[0]
        : undefined,
      support: scenario.canDo,
    })
  })

  return tasks
    .filter(task => task.prompt.length > 0)
    .sort((a, b) => a.page - b.page || a.source.localeCompare(b.source))
    .slice(0, options.limit ?? 8)
}
