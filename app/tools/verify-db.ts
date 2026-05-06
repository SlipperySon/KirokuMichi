import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../data/kiroku.db')

async function verify() {
  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(dbPath)
  const db = new SQL.Database(new Uint8Array(buffer))
  
  const tables = [
    ['cards', "SELECT COUNT(*) as count FROM cards"],
    ['grammar_points', "SELECT COUNT(*) as count FROM grammar_points"],
    ['users', "SELECT COUNT(*) as count FROM users"],
  ]
  
  for (const [name, query] of tables) {
    const result = db.exec(query)
    if (result[0]) {
      const count = result[0].values[0][0]
      console.log(`${name}: ${count} records`)
    }
  }
  
  db.close()
}

verify().catch(console.error)
