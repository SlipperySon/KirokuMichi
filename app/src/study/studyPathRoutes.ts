/** Lesson route helpers shared by the study path planner. */

export function lessonRouteFromId(lessonId: string, options?: { autostart?: boolean; resume?: boolean }) {
  if (options?.resume) {
    return `/learn/study?resume=${encodeURIComponent(lessonId)}`
  }
  const match = lessonId.match(/^(genki_[12]|quartet_[12])_(\d+)$/)
  if (!match) return '/learn'
  const [, series, lessonNumber] = match
  const cefr = series === 'genki_1'
    ? 'a1'
    : series === 'genki_2'
      ? 'a2'
      : series === 'quartet_1'
        ? 'b1'
        : 'b2'
  const base = `/learn/lessons/${cefr}/${lessonNumber}`
  return options?.autostart ? `${base}?autostart=1` : base
}

export function formatLessonLabel(lessonId: string) {
  const match = lessonId.match(/^(genki|quartet)_([12])_(\d+)$/)
  if (!match) {
    return lessonId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  const [, book, volume, n] = match
  const bookLabel = book === 'genki'
    ? `Genki ${volume === '1' ? 'I' : 'II'}`
    : `Quartet ${volume}`
  return `${bookLabel} · Lesson ${Number(n)}`
}
