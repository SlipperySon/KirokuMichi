/**
 * Console Debug Script for Vocabulary Loading Test
 *
 * Open DevTools (F12) on http://localhost:5173/study
 * Paste this entire script into the Console tab and press Enter
 *
 * This will print diagnostic info about:
 * - Database state
 * - Vocabulary counts
 * - Card types
 * - Session state
 */

(async function debugVocabLoading() {
  console.log('🔍 === VOCABULARY LOADING DEBUG ===\n')

  // 1. Check localStorage DB
  console.log('1️⃣  Database State')
  console.log('─'.repeat(50))
  const dbSaved = localStorage.getItem('kiroku_michi_db')
  console.log(`✅ DB in localStorage: ${dbSaved ? 'YES (' + (dbSaved.length / 1024).toFixed(1) + ' KB)' : 'NO'}`)

  // 2. Check session recovery
  console.log('\n2️⃣  Session Recovery State')
  console.log('─'.repeat(50))
  const recovery = localStorage.getItem('kiroku_michi_recovery')
  if (recovery) {
    const payload = JSON.parse(recovery)
    console.log(`✅ Recovery payload exists`)
    console.log(`   - Session ID: ${payload.sessionId}`)
    console.log(`   - Queue size: ${payload.queue.length}`)
    console.log(`   - Current index: ${payload.currentIndex}`)
    console.log(`   - Saved at: ${new Date(payload.savedAt).toLocaleString()}`)
    const age = Date.now() - payload.savedAt
    console.log(`   - Age: ${(age / 1000).toFixed(0)} seconds (stale if > 86400s)`)
  } else {
    console.log('⚠️  No recovery payload (expected on first load)')
  }

  // 3. Check app store state
  console.log('\n3️⃣  App Store State')
  console.log('─'.repeat(50))
  try {
    const storeJson = localStorage.getItem('app-store')
    if (storeJson) {
      const store = JSON.parse(storeJson)
      console.log(`✅ Active user ID: ${store.state?.activeUserId || 'none'}`)
      console.log(`✅ Onboarding complete: ${store.state?.onboardingComplete}`)
    } else {
      console.log('⚠️  No app store yet (first load?)')
    }
  } catch (e) {
    console.log('❌ Error parsing store:', e.message)
  }

  // 4. Check imported vocab files
  console.log('\n4️⃣  Vocabulary JSON Imports')
  console.log('─'.repeat(50))
  const vocabLevels = ['N5', 'N3', 'N2']
  for (const level of vocabLevels) {
    try {
      const module = await import(`/data/generated/jlpt/vocab-${level}.json`, { assert: { type: 'json' } })
      const vocab = Array.isArray(module.default) ? module.default : module
      console.log(`✅ vocab-${level}.json: ${vocab.length} items`)
    } catch (e) {
      console.log(`❌ vocab-${level}.json: FAILED - ${e.message}`)
    }
  }

  // 5. Estimate total vocab seeded
  console.log('\n5️⃣  Expected Vocabulary Count')
  console.log('─'.repeat(50))
  console.log('Expected: 4,342 total (N5: 532, N3: 401, N2: 3,409)')
  console.log('Once seeded, dashboard should show ~4,342 "New" cards')

  // 6. Check for errors in page
  console.log('\n6️⃣  Page Errors (last 20 console errors)')
  console.log('─'.repeat(50))
  // Note: This is a hint to manually check console errors
  console.log('❗ Check console for red error messages above')
  console.log('Common issues:')
  console.log('  - Import errors for vocab JSON files')
  console.log('  - "Cannot read property of undefined" in VocabService')
  console.log('  - Database query failures')

  // 7. Check React component state (if available)
  console.log('\n7️⃣  Tips for Debugging')
  console.log('─'.repeat(50))
  console.log('If vocabulary doesn\'t load:')
  console.log('  1. Reload page (Cmd+Shift+R on Mac)')
  console.log('  2. Check Network tab for failed vocab-*.json imports')
  console.log('  3. Look in /tmp/dev.log for server errors')
  console.log('  4. Check if vocabService.seedVocabulary() is being called')

  // 8. Manual DB check
  console.log('\n8️⃣  Manual Database Check')
  console.log('─'.repeat(50))
  console.log('To manually query the database from console:')
  console.log('(This requires the storage object to be exposed)')
  console.log('  Example: await storage.query("SELECT COUNT(*) FROM cards WHERE type=\'vocabulary\'", [])')

  console.log('\n' + '='.repeat(50))
  console.log('Debug complete! Check results above.')
  console.log('='.repeat(50))
})().catch(e => {
  console.error('❌ Debug script error:', e)
})
