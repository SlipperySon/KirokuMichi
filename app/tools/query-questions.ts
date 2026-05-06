import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/kiroku.db')

const SQL = await initSqlJs()
const buffer = fs.readFileSync(dbPath)
const db = new SQL.Database(new Uint8Array(buffer))

const result = db.exec('SELECT id, prompt, options_json, answer FROM questions')
if (result[0]) {
  result[0].values.forEach(row => {
    const options = JSON.parse(row[2] as string)
    console.log(JSON.stringify({ id: row[0], prompt: row[1], options, answer: row[3] }))
  })
} else {
  console.log('No questions found')
}
db.close()
