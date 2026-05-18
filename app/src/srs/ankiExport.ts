import JSZip from 'jszip'
import type { ReviewCard } from '../study/types'

function sha1Csum(text: string): number {
  // Simple checksum: sum of char codes, take first 8 digits
  let sum = 0
  for (let i = 0; i < Math.min(text.length, 9); i++) {
    sum = sum * 31 + text.charCodeAt(i)
    sum = sum >>> 0
  }
  return sum % 100000000
}

export async function exportToAnki(cards: ReviewCard[], deckName = 'KirokuMichi'): Promise<void> {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({ locateFile: f => `/sql.js/${f}` })
  const db = new SQL.Database()

  const deckId = Date.now()
  const modelId = deckId + 1
  const now = Math.floor(Date.now() / 1000)

  const model = {
    id: String(modelId),
    name: 'KirokuMichi',
    flds: [
      { name: 'Front', ord: 0 },
      { name: 'Back', ord: 1 },
      { name: 'Reading', ord: 2 },
    ],
    tmpls: [{
      name: 'Card 1',
      ord: 0,
      qfmt: '{{Front}}',
      afmt: '{{FrontSide}}<hr>{{Back}}<br><small>{{Reading}}</small>',
    }],
    mod: now,
    type: 0,
    sortf: 0,
  }

  const deck = {
    [deckId]: {
      id: deckId, name: deckName, desc: '', mod: now,
      usn: -1, collapsed: false, newToday: [0, 0], revToday: [0, 0],
      lrnToday: [0, 0], timeToday: [0, 0], conf: 1,
    },
  }

  db.run(`CREATE TABLE col (
    id INTEGER PRIMARY KEY, crt INTEGER, mod INTEGER, scm INTEGER,
    ver INTEGER, dty INTEGER, usn INTEGER, ls INTEGER,
    conf TEXT, models TEXT, decks TEXT, dconf TEXT, tags TEXT
  )`)
  db.run(`INSERT INTO col VALUES (1,?,?,?,11,0,-1,0,'{}',?,?,'{}','{}')`,
    [now, now, now, JSON.stringify({ [modelId]: model }), JSON.stringify(deck)])

  db.run(`CREATE TABLE notes (
    id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER,
    usn INTEGER, tags TEXT, flds TEXT, sfld TEXT, csum INTEGER, flags INTEGER, data TEXT
  )`)
  db.run(`CREATE TABLE cards (
    id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER,
    mod INTEGER, usn INTEGER, type INTEGER, queue INTEGER,
    due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER,
    lapses INTEGER, left INTEGER, odue INTEGER, odid INTEGER, flags INTEGER, data TEXT
  )`)
  db.run(`CREATE TABLE revlog (id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER, ivl INTEGER, lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER)`)
  db.run(`CREATE TABLE graves (usn INTEGER, oid INTEGER, type INTEGER)`)

  let noteOrd = 0
  for (const card of cards) {
    const noteId = deckId + noteOrd + 1
    const flds = [card.front, card.back, card.reading ?? ''].join('\x1f')
    const tags = [card.jlptLevel, card.type].filter(Boolean).map(t => ` ${t} `).join('')
    db.run(`INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,0,'')`,
      [noteId, String(noteId).padStart(10, '0'), modelId, now, -1, tags, flds, card.front, sha1Csum(card.front)])

    const cardId = noteId + 10000000
    db.run(`INSERT INTO cards VALUES (?,?,?,0,?,?,0,0,?,0,2500,0,0,0,0,0,0,'')`,
      [cardId, noteId, deckId, now, -1, noteOrd])

    noteOrd++
  }

  const binary = db.export()
  db.close()

  const zip = new JSZip()
  zip.file('collection.anki2', binary)
  zip.file('media', '{}')

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName}.apkg`
  a.click()
  URL.revokeObjectURL(url)
}
