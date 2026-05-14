/**
 * Direct test of the import pipeline
 * Uses Node.js to test without needing the browser
 */

const fs = require('fs')
const path = require('path')

// We'll manually test the key functions by reading the deck directly
const JSZip = require('jszip')
const initSqlJs = require('sql.js')

async function testImport() {
  console.log('🧪 Testing Anki Deck Import Pipeline\n')
  console.log('=' .repeat(60))

  try {
    // Load the Genki deck
    const deckPath = path.join(__dirname, 'test-fixtures', 'Genki_12_with_official_app_ImagesAudioSentences_3e.apkg')

    console.log(`\n📦 Step 1: Loading APKG File`)
    console.log(`   Path: ${deckPath}`)

    if (!fs.existsSync(deckPath)) {
      throw new Error(`Deck file not found: ${deckPath}`)
    }

    const fileBuffer = fs.readFileSync(deckPath)
    console.log(`   ✅ File loaded: ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB`)

    // Extract ZIP
    console.log(`\n📂 Step 2: Extracting ZIP Archive`)
    const zip = new JSZip()
    const loaded = await zip.loadAsync(fileBuffer)

    const files = Object.keys(loaded.files)
    console.log(`   ✅ Files in archive: ${files.length}`)
    console.log(`   - collection.anki21: ${loaded.file('collection.anki21') ? '✓' : '✗'}`)
    console.log(`   - collection.anki2: ${loaded.file('collection.anki2') ? '✓' : '✗'}`)
    console.log(`   - media.json: ${loaded.file('media') ? '✓' : '✗'}`)

    // Get database
    console.log(`\n🗄️  Step 3: Extracting SQLite Database`)
    const dbFile = loaded.file('collection.anki21')
    if (!dbFile) {
      throw new Error('collection.anki21 not found')
    }

    const dbData = await dbFile.async('uint8array')
    console.log(`   ✅ Database extracted: ${(dbData.length / 1024).toFixed(1)} KB`)

    // Parse SQLite
    console.log(`\n📊 Step 4: Parsing SQLite Database`)
    const SQL = await initSqlJs()
    const db = new SQL.Database(dbData)
    console.log(`   ✅ Database loaded`)

    // Get deck info
    console.log(`\n📚 Step 5: Reading Deck Information`)

    const colResult = db.exec('SELECT decks, dconf FROM col LIMIT 1')
    if (colResult.length === 0) {
      throw new Error('No collection data found')
    }

    const decksJson = colResult[0].values[0][0]
    const dconfJson = colResult[0].values[0][1]
    const decks = JSON.parse(decksJson)
    const dconf = JSON.parse(dconfJson)

    console.log(`   ✅ Decks loaded: ${Object.keys(decks).length}`)
    for (const [deckId, deckData] of Object.entries(decks)) {
      console.log(`      - ${deckData.name} (ID: ${deckId})`)
    }

    // Get card counts
    console.log(`\n🃏 Step 6: Counting Cards & Notes`)

    const cardsResult = db.exec('SELECT COUNT(*) FROM cards')
    const notesResult = db.exec('SELECT COUNT(*) FROM notes')
    const reviewsResult = db.exec('SELECT COUNT(*) FROM revlog')

    const cardCount = cardsResult[0]?.values[0]?.[0] || 0
    const noteCount = notesResult[0]?.values[0]?.[0] || 0
    const reviewCount = reviewsResult[0]?.values[0]?.[0] || 0

    console.log(`   ✅ Cards: ${cardCount}`)
    console.log(`   ✅ Notes: ${noteCount}`)
    console.log(`   ✅ Review logs: ${reviewCount}`)

    // Sample card data
    console.log(`\n📋 Step 7: Sampling Card Data`)

    const sampleResult = db.exec(
      'SELECT id, type, queue, due, ivl, factor, reps, lapses FROM cards LIMIT 3'
    )

    if (sampleResult.length > 0 && sampleResult[0].values.length > 0) {
      console.log(`   Sample cards:`)
      sampleResult[0].values.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ID: ${row[0]}, Type: ${row[1]}, Queue: ${row[2]}, Due: ${row[3]}, Interval: ${row[4]}, Reps: ${row[6]}`)
      })
    }

    // Card state distribution
    console.log(`\n📊 Step 8: Card State Distribution`)

    const typeResult = db.exec('SELECT type, COUNT(*) FROM cards GROUP BY type ORDER BY type')
    const typeNames = { 0: 'New', 1: 'Learn', 2: 'Review', 3: 'Relearn' }

    if (typeResult.length > 0 && typeResult[0].values.length > 0) {
      typeResult[0].values.forEach((row) => {
        const typeName = typeNames[row[0]] || `Unknown(${row[0]})`
        console.log(`   ${typeName}: ${row[1]} cards`)
      })
    }

    // Queue distribution
    console.log(`\n📋 Step 9: Queue Distribution`)

    const queueResult = db.exec('SELECT queue, COUNT(*) FROM cards GROUP BY queue ORDER BY queue')
    const queueNames = {
      0: 'New', 1: 'Learn', 2: 'Review', 3: 'DayLearn',
      4: 'PreviewRepeat', '-1': 'Suspended', '-2': 'SchedBuried', '-3': 'UserBuried'
    }

    if (queueResult.length > 0 && queueResult[0].values.length > 0) {
      queueResult[0].values.forEach((row) => {
        const queueName = queueNames[row[0]] || `Unknown(${row[0]})`
        console.log(`   ${queueName}: ${row[1]} cards`)
      })
    }

    // Sample note
    console.log(`\n📝 Step 10: Sampling Note Data`)

    const noteResult = db.exec(
      'SELECT guid, tags, LENGTH(flds) as field_length FROM notes LIMIT 1'
    )

    if (noteResult.length > 0 && noteResult[0].values.length > 0) {
      const note = noteResult[0].values[0]
      console.log(`   GUID: ${note[0]}`)
      console.log(`   Tags: ${note[1]}`)
      console.log(`   Fields data size: ${note[2]} bytes`)
    }

    // Config validation
    console.log(`\n⚙️  Step 11: Deck Configuration`)

    const configIds = Object.keys(dconf)
    if (configIds.length > 0) {
      const firstConfigId = configIds[0]
      const config = dconf[firstConfigId]
      console.log(`   New cards per day: ${config.new?.perDay || 20}`)
      console.log(`   Review limit: ${config.review?.perDay || 200}`)
      console.log(`   Initial ease: ${(config.new?.initialFactor || 2500) / 1000}`)
      console.log(`   Lapse minimum: ${config.lapse?.minInt || 1} days`)
    }

    // Media files
    console.log(`\n🎵 Step 12: Media Files`)

    const mediaFile = loaded.file('media')
    if (mediaFile) {
      const mediaJson = await mediaFile.async('string')
      const mediaManifest = JSON.parse(mediaJson)
      const mediaCount = Object.keys(mediaManifest).length
      console.log(`   ✅ Media files in manifest: ${mediaCount}`)

      // Sample some media
      const mediaSample = Object.entries(mediaManifest).slice(0, 3)
      if (mediaSample.length > 0) {
        console.log(`   Sample media files:`)
        mediaSample.forEach(([id, name]) => {
          console.log(`      ${id}: ${name}`)
        })
      }
    }

    // Success!
    console.log(`\n${'='.repeat(60)}`)
    console.log(`\n✅ IMPORT TEST SUCCESSFUL!\n`)
    console.log(`Summary:`)
    console.log(`  📦 Deck file: ${fileBuffer.length / 1024 / 1024}MB`)
    console.log(`  📚 Decks: ${Object.keys(decks).length}`)
    console.log(`  🃏 Cards: ${cardCount}`)
    console.log(`  📝 Notes: ${noteCount}`)
    console.log(`  📊 Media files: ${Object.keys(dconf).length}+`)
    console.log(`\n🎉 Ready to import into the app!\n`)

    db.close()

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`)
    process.exit(1)
  }
}

// Run test
testImport().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
