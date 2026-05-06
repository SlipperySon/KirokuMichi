# JLPT Vocabulary Scope — Phase 5

**Current Status:** May 4, 2026

---

## Current Scope: JLPT N5-N3 Only

### What's Included Now

| Level | Items | Source |
|-------|-------|--------|
| **N5** | 714 | all.csv (JLPT_5 tag) |
| **N4** | 634 | VocabList.N4.txt (tanos.co.uk) |
| **N3** | 2,139 | VocabList.N3.txt (tanos.co.uk) |
| **TOTAL** | **3,487** | |

### What's Excluded (For Later Phases)

| Level | Items | Status |
|-------|-------|--------|
| **N2** | ~3,400 (estimated) | Planned for Phase X |
| **N1** | ~2,800 (estimated) | Planned for Phase X |

---

## Why This Scope?

**Decision Rationale:**
- Focus on foundational levels first (N5-N3) with proper testing
- Allows complete curriculum coverage before adding advanced levels
- Better user experience: master intermediate before advanced
- Reduces initial data load and testing complexity

---

## When N2 & N1 Will Be Added

- **Current Phase:** Phase 5 (N5-N3 vocabulary + seeding infrastructure)
- **Future Phases:** N2 and N1 vocabulary will be integrated when:
  - Phase 5 vocabulary testing is complete and validated
  - Phase 6+ (Quiz/Grammar generation) is stable
  - User progression data indicates readiness for advanced levels

---

## For Users/Testers

### What to Expect Now
- **3,487 vocabulary cards** from JLPT N5-N3 levels
- Full review cycle through three proficiency tiers
- Session tracking and streak counting

### What Will Come Later
- N2 vocabulary (~3,400 more words)
- N1 vocabulary (~2,800 more words)
- Combined corpus of ~9,600+ JLPT words across all levels

---

## Implementation Note

**No code changes required** to add N2/N1 later. The infrastructure supports it:
- VocabService.seedVocabulary() can load any JLPT level
- Database schema has no level restrictions
- Review logic treats all levels identically

Just need:
1. VocabList.N2.txt and VocabList.N1.txt source files
2. Parse them to JSON (same format as N5-N4-N3)
3. Drop them in `/app/data/generated/jlpt/`
4. Update StudyDashboard to seed N2 and N1

---

## Summary

**Right now:** 3,487 words across JLPT N5-N3  
**Eventually:** Will expand to ~9,600+ words across all JLPT levels  
**No worries:** Infrastructure is ready for expansion whenever needed
