export function lessonNumberFromId(lessonId: string): number | null {
  const matches = [...lessonId.matchAll(/_(\d+)/g)]
  const last = matches.at(-1)?.[1]
  if (!last) return null
  const parsed = Number(last)
  return Number.isFinite(parsed) ? parsed : null
}

export function canonicalSourceLessonId(lessonId: string) {
  const lessonNum = lessonNumberFromId(lessonId)
  if (!lessonNum) return lessonId

  if (lessonId.startsWith('genki_2_') && lessonNum >= 1 && lessonNum <= 11) {
    return `genki_2_${lessonNum + 12}`
  }

  if (lessonId.startsWith('quartet_2_') && lessonNum >= 1 && lessonNum <= 6) {
    return `quartet_2_${lessonNum + 6}`
  }

  return lessonId
}

export function coreLessonIdFromSource(lessonId: string) {
  const lessonNum = lessonNumberFromId(lessonId)
  if (!lessonNum) return lessonId

  if (lessonId.startsWith('genki_2_') && lessonNum >= 13 && lessonNum <= 23) {
    return `genki_2_${lessonNum - 12}`
  }

  if (lessonId.startsWith('quartet_2_') && lessonNum >= 7 && lessonNum <= 12) {
    return `quartet_2_${lessonNum - 6}`
  }

  return lessonId
}

function addLessonAlias(aliases: Set<string>, series: string, lessonNumber: number) {
  aliases.add(`${series}_${lessonNumber}`)
}

export function lessonAliasesFor(lessonId: string, lessonNum: number) {
  const aliases = new Set([lessonId, lessonNum.toString()])
  aliases.add(canonicalSourceLessonId(lessonId))

  if (lessonId.startsWith('genki_2_')) {
    addLessonAlias(aliases, 'genki_2', lessonNum + 12)
  }

  if (lessonId.startsWith('quartet_2_')) {
    addLessonAlias(aliases, 'quartet_2', lessonNum + 6)
  }

  return aliases
}

export function createLessonMatcher(lessonId: string, lessonNum: number) {
  const aliases = lessonAliasesFor(lessonId, lessonNum)
  return (itemLesson: string) => {
    if (aliases.has(itemLesson)) return true
    return [...aliases].some(alias => itemLesson.endsWith(`_${alias}`))
  }
}

export function formatTextbookName(textbookKey: string) {
  return textbookKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .replace(/\bI{1,2}\b/g, match => match.toUpperCase())
}

export function pageRangeFromPages(pages: number[]) {
  const valid = pages.filter(page => Number.isFinite(page) && page > 0)
  if (valid.length === 0) return 'Unpaged generated content'
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  return min === max ? `p. ${min}` : `pp. ${min}-${max}`
}
