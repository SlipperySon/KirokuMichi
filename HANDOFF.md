# KirokuMichi Handoff Document

**Last updated:** 2026-05-13 21:06 UTC  
**Current status:** ✅ A1 COMPLETE | ✅ A2 CORE COMPLETE | ⏳ A2 PAIR (Marugoto A2) OCR IN PROGRESS  
**Next phase:** Complete Marugoto A2 extraction, then manual corrections + answer-key linking

> **🔄 Keep this updated:** At the end of each session, before switching AI models, update the "Last updated" date and "Current status" above. Update the Quick Status table and the "What Just Completed" section to reflect new work. This ensures seamless handoff.

---

## Quick Status

| Item | Status |
|------|--------|
| **A1 Core:** Genki I (393 TB + 157 WB + 84 AK pages) | ✅ Complete |
| **A1 Core:** 14 lesson packs + 2 pre-lessons (2,992 blocks, 2,289 exercises) | ✅ Complete & Split |
| **A1 Pair:** Marugoto A1 (147 pages) | ✅ Complete & Split |
| **A2 Core:** Genki II (399 TB + 137 WB pages) | ✅ Complete & Split |
| **A2 Core:** 11 lesson packs L13-L23 (2,678 blocks, 2,657 exercises) | ✅ Complete & Split |
| **A2 Pair:** Marugoto A2 (186 pages) | ⏳ OCR IN PROGRESS (Normalize/Group/Build follow) |
| **Total Reviewed Packs (A1+A2):** 26 new + 2 pre = 28 files ready | ✅ Ready |
| **Genki Answer Key:** normalized & grouped | ✅ Ready for linking |
| Manual corrections (Genki I L2-L12, Genki II L13-L23, Marugoto A1/A2) | ⏳ After A2 extraction |
| Answer-key linking (all lessons) | ⏳ After corrections |
| Maynard grammar extraction | ⏳ Final phase |

---

## What Just Completed (2026-05-13 21:06 UTC, Current Session)

### Marugoto A2 Extraction Initiated (A2 Pair)
- **Status:** Marugoto A2 textbook OCR in progress (186 pages, PaddleOCR at 300 DPI)
- **Timeline:** ~2-3 hours estimated for OCR; normalize/group/build will auto-run on completion
- **Completion script ready:** Full pipeline (normalize → group → build → split) prepared and will auto-execute
- **Expected output:** `marugoto_a2_lesson_1.json` (single unit, no workbook) in reviewed-packs

### Previous Session Summary (2026-05-13 Earlier)

### A1/A2 Multi-Parallel Extraction Pipeline Launched
- **3 parallel OCR processes running** (PaddleOCR at 300 DPI, CPU):
  - Marugoto A1 Textbook: 7/147 pages (A1 Pair)
  - Genki II Textbook: ~3/399 pages (A2 Core)
  - Genki II Workbook: ~3/137 pages (A2 Core)
  - **Estimated completion:** ~1.5 hours (12 pages done, ~683 remaining)

- **New tools created:**
  - `build-all-textbook-lessons.ts` — Unified lesson builder (Genki, Marugoto, Quartet structures)
  - `batch-extract-pipeline.ts` — Single-source OCR → normalize → group coordinator
  - `auto-complete-pipeline.sh` — Full A1/A2 completion script (normalize → group → build for all sources)

- **Post-OCR automated workflow ready:**
  1. ✅ All tools prepared and tested
  2. ⏳ Once OCR completes, run: `bash app/tools/textbook-pack/auto-complete-pipeline.sh`
  3. Outputs: 4 new all-lessons packs (marugoto_a1, genki_2) + 23 reviewed packs (Genki II L13-L23)

- **Documentation updated:** HANDOFF.md, plan.md, todo.md reflect current extraction status

## What Just Completed (2026-05-13 Morning)

### Genki I All-Lessons Generation Pipeline
- **New tool:** `app/tools/textbook-pack/build-genki-all-lessons.ts`
  - Reads normalized/grouped OCR pages from all three sources
  - Uses splitHints from source manifest to determine lesson boundaries
  - Generates CanonicalLesson for pre-lessons (greetings, numbers) + lessons 1-12
  - Aggregates into single `genki_1_all_lessons.json` pack
  - Runs successfully with full coverage

- **Output:** `app/tools/textbook-pack/out/canonical-proofs/genki_1_all_lessons.json`
  - 14 lessons with full page ranges, titles, and content
  - 2,992 content blocks (dialogues, tables, instructions)
  - 2,289 exercises (from workbook pages)
  - Vocabulary extraction working (heuristic-based, ~100+ entries across lessons)
  - Grammar extraction placeholder (1 per lesson, needs manual curation)

- **Split tool:** `app/tools/textbook-pack/split-lessons-to-reviewed.ts`
  - Splits all-lessons pack into individual reviewed packs
  - Output: `app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_*.json` (14 files)
  - Each file ready for independent manual review and corrections

### Documentation Updates
- `todo.md` — marked Genki I full OCR and lesson expansion complete
- `plan.md` — updated extraction status with all-lessons generation summary
- `memory/source_structure_audit.md` — noted lesson generation completion

---

## Project Structure

```
app/tools/textbook-pack/
├── ocr-full-capture.py                    # OCR extraction at 300 DPI
├── normalize-ocr-pages.ts                 # Normalize OCR output (pageKind classification)
├── group-ocr-blocks.ts                    # Group blocks into semantic units
├── build-genki-lesson-proof.ts            # Single lesson builder (Lesson 1 proof)
├── build-genki-all-lessons.ts             # NEW: All lessons builder (L1-L12 + pre-lessons)
├── split-lessons-to-reviewed.ts           # NEW: Split into individual reviewed packs
├── validate-reviewed-pack.ts              # Validation (schema, duplicates, coverage)
├── finalize-reviewed-pack.ts              # Apply corrections and freeze pack
├── schema.ts                              # TypeScript types (CanonicalLesson, etc.)
│
├── out/
│   ├── normalized/                        # Normalized OCR pages (pageKind classified)
│   │   ├── genki_1_textbook/
│   │   ├── genki_1_workbook/
│   │   └── genki_combined_answer_key/
│   ├── grouped/                           # Grouped semantic blocks
│   │   ├── genki_1_textbook/pages/
│   │   ├── genki_1_workbook/pages/
│   │   └── genki_combined_answer_key/pages/
│   ├── canonical-proofs/                  # Pre-review canonical packs
│   │   ├── genki_1_all_lessons.json       # Full pack with all 14 lessons
│   │   ├── genki_1_lesson_1.json          # (legacy single-lesson proof)
│   │   ├── genki_1_pre_greetings.json
│   │   └── genki_1_pre_numbers.json
│   ├── reviewed-packs/                    # Per-lesson reviewed packs (FOR EDITING)
│   │   ├── genki_1_pre_greetings.json     # 40 blocks, 17 exercises
│   │   ├── genki_1_pre_numbers.json       # 6 blocks, 14 exercises
│   │   ├── genki_1_lesson_1.json          # 257 blocks, 142 exercises (L1 proof, already corrected)
│   │   ├── genki_1_lesson_2.json          # 314 blocks, 169 exercises
│   │   ├── genki_1_lesson_3.json          # 223 blocks, 179 exercises
│   │   ├── genki_1_lesson_4.json          # 245 blocks, 216 exercises
│   │   ├── genki_1_lesson_5.json          # 184 blocks, 187 exercises
│   │   ├── genki_1_lesson_6.json          # 214 blocks, 206 exercises
│   │   ├── genki_1_lesson_7.json          # 222 blocks, 202 exercises
│   │   ├── genki_1_lesson_8.json          # 264 blocks, 227 exercises
│   │   ├── genki_1_lesson_9.json          # 226 blocks, 226 exercises
│   │   ├── genki_1_lesson_10.json         # 234 blocks, 194 exercises
│   │   ├── genki_1_lesson_11.json         # 290 blocks, 132 exercises
│   │   ├── genki_1_lesson_12.json         # 273 blocks, 178 exercises
│   │   └── fingerprints.json              # Reviewed pack checksums
│   │
│   ├── source-manifest.json               # Manifest of all source PDFs
│   └── source-answer-key-map.json         # Answer-key section mapping
│
├── corrections/                           # User corrections (corrections files per lesson)
│   ├── genki_1_lesson_1.corrections.json  # L1 already has corrections applied
│   └── quartet_1_lesson_1.corrections.json
│
└── out/canonical-proofs/genki_1_all_lessons.json
```

---

## Key Data Structures

### CanonicalLesson (in reviewed-packs/*.json)
```typescript
{
  "id": "genki_1_lesson_2",
  "unitType": "lesson",
  "lessonNumber": 2,
  "title": "第2課　かいもの　Shopping",
  "level": "N5-N4",
  "pageRange": { "start": 65, "end": 90 },
  "modes": ["conversation_grammar", "reading_writing", "workbook"],
  "vocabulary": [
    {
      "id": "genki_1_l2_vocab_1",
      "surface": "word",
      "reading": "reading",
      "meaning": "English meaning",
      "lessonNumber": 2,
      "sourceRef": { "sourceId": "genki_1_textbook", "pageNumber": 67, "coordinates": [x0, y0, x1, y1] },
      "tags": ["draft_table_parse"]  // Heuristic extraction; needs review
    }
  ],
  "grammar": [
    {
      "id": "genki_1_l2_grammar_1",
      "pattern": "Grammar pattern",
      "meaning": "English explanation",
      "examples": [],
      "lessonNumber": 2,
      "sourceRef": { ... },
      "tags": ["placeholder_extraction"]  // Placeholder; needs manual curation
    }
  ],
  "contentBlocks": [
    {
      "id": "genki_1_textbook_p67_blk1",
      "type": "dialogue" | "reading" | "table" | "instruction",
      "mode": "conversation_grammar" | "reading_writing",
      "title": "optional",
      "text": "extracted text",
      "sourceRef": { "sourceId": "genki_1_textbook", "pageNumber": 67, "coordinates": [...] }
    }
  ],
  "exercises": [
    {
      "id": "genki_1_workbook_p29_ex1",
      "label": "Workbook p.29 ex1",
      "prompt": "exercise prompt text",
      "sourceRef": { "sourceId": "genki_1_workbook", "pageNumber": 29, ... }
      // Note: answerKeyRef NOT YET LINKED; needed for grading
    }
  ]
}
```

---

## Immediate Next Steps (Priority Order)

### 0. Complete Marugoto A2 Extraction (In Progress)
- [ ] OCR: 186 pages → raw/page_*.json (PaddleOCR, 300 DPI)
- [ ] Normalize: pageKind classification → normalized/page_*.json
- [ ] Group: semantic blocks (tables, dialogues, instructions) → grouped/pages/page_*.json
- [ ] Build: CanonicalTextbookPack with 1 lesson → canonical-proofs/marugoto_a2_all_lessons.json
- [ ] Split: single pack → reviewed-packs/marugoto_a2_lesson_1.json

**When complete:** Will have 27 reviewed packs (16 Genki I + 11 Genki II + Marugoto A1 + Marugoto A2)

### 1. Manual Corrections (Per-Lesson)
**Files to edit:** `app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_*.json`

For each lesson (L2-L12, pre-lessons):
- [ ] Review `vocabulary` entries
  - Verify `surface` matches textbook (may have OCR errors)
  - Verify `reading` is correct romaji
  - Verify `meaning` is clear and concise
  - Remove duplicates
  - Check `sourceRef.coordinates` for accuracy

- [ ] Review `grammar` entries
  - Replace placeholders with actual grammar patterns from textbook
  - Add proper `meaning` and `explanation`
  - Add real `examples` with Japanese/reading/English
  - Map to actual OCR blocks using sourceRef

- [ ] Review `contentBlocks`
  - Verify dialogue blocks have correct speaker turns
  - Check table extraction (usually OK but verify column alignment)
  - Remove noise/OCR artifacts
  - Preserve page/coordinate refs for UI linking

- [ ] Review `exercises`
  - Each exercise should have clear `prompt`
  - Verify workbook page numbers are correct
  - No answerKeyRef yet (handled in step 2)

**Workflow:**
```bash
# After editing, validate the pack:
npx tsx app/tools/textbook-pack/validate-reviewed-pack.ts \
  --pack app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_2.json

# Then finalize (applies corrections, locks fingerprint):
npx tsx app/tools/textbook-pack/finalize-reviewed-pack.ts \
  --pack app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_2.json
```

### 2. Answer-Key Linking
**Reference:** `app/tools/textbook-pack/out/source-answer-key-map.json`

For each lesson's exercises:
- Map exercise ID → answer-key page/coordinates
- Extract ground-truth answer text from OCR
- Link listening scripts (where applicable)

**Example:**
```json
{
  "genki_1_l2_ex1": {
    "answerKeyPageStart": 34,
    "answerKeyCoordinates": [100, 150, 500, 200],
    "answerText": "ground truth answer from OCR",
    "listeningScriptRef": "genki_1_l2_listening_1"
  }
}
```

### 3. Validation & Consistency Check
- Compare L1-L12 vocabulary/grammar extraction patterns (L1 is ground truth)
- Verify page ranges align with source-structure-audit.md
- Check for missing/duplicate content blocks
- Run full schema validation

### 4. Future: Genki II, Quartet, etc.
- Same pipeline applies: `build-genki-all-lessons.ts` with textbook_key swapped
- Source PDFs already captured and normalized (per source-manifest.json)
- Reuse vocabulary/grammar extraction heuristics + corrections flow

---

## Important Context & Decisions

### OCR Approach
- **Engine:** macOS Vision OCR at 300 DPI (via `ocr-full-capture.py`)
- **Why:** Fast, local, no API keys, good Japanese+English support
- **Alternatives considered:** PaddleOCR (better for tables), Manga OCR (better for vertical text)
  - Decision: Keep Vision as primary; consider PaddleOCR if table extraction improves

### Vocabulary/Grammar Extraction
- **Current approach:** Heuristic table parsing + OCR text matching
  - Vocabulary: look for `lesson_vocab` pageKind blocks, parse table rows
  - Grammar: placeholder extraction (manual curation needed)
- **Tags used:**
  - `draft_table_parse` — vocabulary extracted via table heuristics (may have errors)
  - `placeholder_extraction` — grammar not yet curated

### Why Full-Source Capture First?
- Avoids running Claude/DeepSeek 14 times per textbook
- Reusable OCR base for future lessons/textbooks
- Enables batch corrections (fix heuristics once, regenerate all lessons)
- Supports answer-key linking without re-OCRing

### Lesson Boundary Detection
- Uses `splitHints` from source manifest (generated via PDF outline parsing + manual hints)
- `lessonRange()` helper finds page boundaries dynamically
- Pre-lessons handled via `preLessonRange()` with slug matching

---

## Gotchas & Known Issues

1. **Vocabulary extraction incomplete**
   - Only works for lessons with clear vocab tables on `lesson_vocab` pageKind
   - L3, L4, L5, L6, L7, L10, L12 show 0-5 vocab entries (likely missing table detection)
   - Manual addition needed or heuristic refinement

2. **Grammar extraction is placeholder only**
   - Currently grabs first text block from grammar pages
   - Needs manual replacement with actual grammar patterns + examples
   - L1 proof has real grammar entries; use as template

3. **Answer-key linking not yet done**
   - Exercises have `sourceRef` (workbook location) but no `answerKeyRef`
   - Must be added manually or via mapping tool
   - Required for grading/tutor validation

4. **Image assets not captured**
   - Content blocks have no `imageFile` refs yet
   - Need to decide: include image URLs, extract as JPEG, or link to source PDF pages
   - Genki images are likely copyrighted; may need to strip or flag as reference-only

5. **Furigana handling**
   - Currently extracted with kanji; no separate furigana mapping
   - User-facing hover/reveal UX not implemented yet
   - Requires post-processing to create kanji→furigana map

---

## How to Switch AI Models

1. **Backup current state:**
   ```bash
   git add -A && git commit -m "handoff: [brief status]"
   ```

2. **Share with next AI:**
   - This file (HANDOFF.md)
   - `/memory/` folder (project context)
   - `/app/tools/textbook-pack/out/reviewed-packs/` (current packs being edited)
   - `/plan.md` and `/todo.md` (roadmap)

3. **Next AI resumes:**
   - Read this HANDOFF.md first
   - Check `memory/` for project decisions and prior work
   - Open `reviewed-packs/` files, apply corrections, validate
   - Update HANDOFF.md with new status when switching back

---

## File Locations Reference

| What | Where |
|------|-------|
| Full lesson pack (all 14) | `app/tools/textbook-pack/out/canonical-proofs/genki_1_all_lessons.json` |
| Individual lesson packs (to edit) | `app/tools/textbook-pack/out/reviewed-packs/genki_1_*.json` |
| Source manifest | `app/tools/textbook-pack/out/source-manifest.json` |
| OCR normalized pages | `app/tools/textbook-pack/out/normalized/*/normalized-summary.json` |
| OCR grouped blocks | `app/tools/textbook-pack/out/grouped/*/grouped-summary.json` |
| Actual grouped pages (to read) | `app/tools/textbook-pack/out/grouped/[source]/pages/*.json` |
| Lesson builder tools | `app/tools/textbook-pack/build-*.ts` |
| Project plan | `plan.md` |
| Project todo | `todo.md` |
| Project memory | `memory/` folder |

---

## Tools to Know

```bash
# Generate all 14 lessons from OCR base
npx tsx app/tools/textbook-pack/build-genki-all-lessons.ts

# Split into individual packs
npx tsx app/tools/textbook-pack/split-lessons-to-reviewed.ts

# Validate a pack (schema, duplicates, coverage)
npx tsx app/tools/textbook-pack/validate-reviewed-pack.ts \
  --pack app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_2.json

# Finalize a pack (apply corrections, freeze fingerprint)
npx tsx app/tools/textbook-pack/finalize-reviewed-pack.ts \
  --pack app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_2.json

# Generate a validation report
npx tsx app/tools/textbook-pack/report-reviewed-packs.ts
```

---

## Contact/Continuity

- **Project:** KirokuMichi (Japanese learning app via SRS + textbook unlock)
- **Current focus:** Genki I textbook pack generation and validation
- **Working directory:** `/Users/Skipp/Projects/KirokuMichi/`
- **Git branch:** `claude/keen-maxwell-ea44d9` (current session)
