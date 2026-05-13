# Textbook Pack Strategy

Decision date: 2026-05-10

For mapped textbooks such as Genki, the preferred path is no longer repeated generic PDF OCR plus AI extraction. Instead:

- Generate accurate structured JSON packs offline with a specialized pipeline.
- Evaluate Apple Vision OCR vs PaddleOCR/PP-OCRv5 for textbook pages. Manga OCR is more likely useful for manga/immersion, not Genki textbooks.
- Encrypt structured textbook packs before shipping them in the app.
- Require the user to upload their own matching textbook/workbook PDFs locally to unlock/decrypt the corresponding pack.
- Keep generic PDF OCR/AI extraction as fallback for unknown PDFs or when no pack is available.

## Dataset Scope

Scope: absolute beginner (N5) through upper-intermediate (N2).

Publisher: The Japan Times.

Target series:

- GENKI 3rd Edition
- QUARTET

GENKI source files:

- Genki I Textbook, 3rd Edition: Lessons 1-12. Includes grammar, dialogue, and a back-of-book Reading & Writing section.
- Genki I Workbook, 3rd Edition: practice for Lessons 1-12.
- Genki II Textbook, 3rd Edition: Lessons 13-23.
- Genki II Workbook, 3rd Edition: practice for Lessons 13-23.
- Genki I & II Answer Key, 3rd Edition: combined answers for both textbooks/workbooks plus listening scripts.

QUARTET source files:

- Quartet I Textbook: Lessons 1-6, roughly JLPT N3, with detachable Bessatsu/Supplement for vocab and kanji.
- Quartet I Workbook: practice drills for Lessons 1-6.
- Quartet I Workbook Answer Key: workbook answers for Vol. 1.
- Quartet II Textbook: Lessons 7-12, roughly JLPT N2, with Bessatsu/Supplement for advanced vocab.
- Quartet II Workbook: practice drills for Lessons 7-12.
- Quartet II Workbook Answer Key: workbook answers for Vol. 2.

## Extraction Rules

- Genki I has pre-lesson Conversation/Grammar sections before Lesson 1:
  - `あいさつ / Greetings`, table-of-contents book page 30, approximately PDF page 39 in the current local source.
  - `すうじ / Numbers`, table-of-contents book page 35, approximately PDF page 44 in the current local source.
  - Lesson 1 is `あたらしいともだち / New Friends`, table-of-contents book page 36, PDF outline page 45 in the current local source.
  - The app should model Greetings/Numbers as pre-lesson study content, not as Lesson 1.
- Genki vocab is listed within each lesson.
- Genki kanji is in the textbook Reading & Writing section.
- Quartet vocab and kanji must prioritize Bessatsu/Supplement lists, not chapter body text.
- Answer keys must be indexed by exercise id and page/coordinate so the tutor can map an exercise such as "Workbook Page 22, Ex. A" to ground truth.
- If a user's sentence is grammatical but does not use the lesson's target structure, the tutor should flag it as correct but off-target.
- Listening scripts from answer keys must be linked to listening exercises for tutor explanations and vocab highlighting.
- Furigana extraction must be validated against known vocab/kanji lists, especially Quartet Bessatsu data.
- Future handwritten workbook checking should compare against answer-key ground truth rather than relying on raw AI vision alone.

Generic importer Genki 1 v3 user-provided page starts:

- Textbook: page 14
- Workbook: page 12

These starts are only for quick generic-import smoke tests. The canonical textbook pack pipeline should OCR/layout every page from each source file first, then filter, classify, and split the output afterward.

First implementation target: full-source extraction scaffolding, then Genki 1 Lesson 1 and Quartet 1 Lesson 1 canonical JSON proofs after all pages have been captured.

Quartet notes:

- Quartet 1: Textbook + Workbook, lessons 1-6, roughly JLPT N3.
- Quartet 2: Textbook + Workbook, lessons 7-12, roughly JLPT N2.
- Quartet textbooks use a separate supplement / 別冊 (Bessatsu) for vocabulary and kanji lists, so pack generation must ingest supplements as first-class source files.
- Quartet lessons should preserve the four-skill structure: Reading (読む), Writing (書く), Speaking (話す), Listening (聞く).
- Textbook pages are source-of-truth for AI tutor content: readings, grammar notes (`文型・表現ノート`), and model dialogues.
- Workbook pages should be converted into challenge/output prompts: drills, true/false, sentence construction, grammar practice, and reading comprehension checks.
- Quartet layout is denser than Genki and likely needs stronger layout extraction: long readings, multi-page essays, diagrams, and text wrapping around images.

## Current Local Source Inventory

Inventory checked: 2026-05-10.

Detailed table-of-contents / source structure audit: `memory/source_structure_audit.md`.

Available and classified in `test-fixtures`:

- Quartet I Textbook: 352 pages. Outline includes lessons 1-6 and embedded `別冊`/Bessatsu sections for vocabulary and kanji.
- Quartet II Textbook: 356 pages. Outline includes lessons 7-12 and embedded `別冊`/Bessatsu sections.
- Quartet I Workbook: 112 pages.
- Quartet II Workbook: 102 pages.
- Quartet I Workbook Answer Key: 102 pages.
- Genki I Textbook, 3rd Edition: 393 pages.
- Genki I Workbook, 3rd Edition: 157 pages.
- Genki II Textbook, 3rd Edition: 399 pages.
- Genki combined Answer Key: 84 pages. Outline includes Genki I/II textbook answers, Genki I/II workbook answers, and workbook listening scripts.
- Genki II Workbook: 137 pages. Manually classified from outline covering Genki II Lessons 13-23 with workbook-like page count; filename lacks a workbook marker.
- Quartet II Workbook Answer Key: 93 pages. Manually classified from sampled cover text (`WORKBOOK ANSWERS`) and Lesson 7 workbook-answer pages.

Manifest/tooling status:

- Source manifest generator added at `app/tools/textbook-pack/generate-source-manifest.ts`.
- Current generated manifest: `app/tools/textbook-pack/out/source-manifest.json`.
- Canonical pack TypeScript schema added at `app/tools/textbook-pack/schema.ts`.
- JSON Schema added at `app/tools/textbook-pack/canonical-pack.schema.json`.
- Full-source PaddleOCR capture runner added at `app/tools/textbook-pack/ocr-full-capture.py`.
- OCR environment requirements recorded at `app/tools/textbook-pack/requirements-ocr.txt`.
- Fast CPU smoke test with PP-OCRv5 mobile models succeeded on Genki I page 1 at 120 DPI: 8 lines in about 5.5 seconds after model download.
- PP-OCRv5 server models were too slow for CPU-only full-book capture in initial testing: one 180 DPI page took about 334 seconds.
- Representative PP-OCRv5 mobile samples at 120 DPI:
  - Genki I Textbook pages 45, 46, 369: lesson pages about 11 seconds each; vocab index page about 32 seconds.
  - Genki I Workbook pages 20, 21, 125: exercise pages about 6 seconds each; kana practice page about 15 seconds.
  - Quartet I Textbook pages 27, 28, 289, 316: skill overview/reading pages about 5-6 seconds, vocab list about 10 seconds, kanji list about 17 seconds.
  - Quartet I Workbook pages 11, 12, 23: dense exercise pages about 11-13 seconds each.
- OCR quality decision:
  - PaddleOCR mobile is viable for raw full-source OCR capture on CPU.
  - Raw OCR text is not sufficient by itself for canonical packs; furigana, tables, indexes, kanji lists, and workbook blanks need a layout/classification/cleanup pass.
  - Next stage should build page-level normalization and section classification, then evaluate Marker/MinerU or equivalent layout extraction for tables and coordinates.
- Page-level normalization/classification status:
  - Normalizer added at `app/tools/textbook-pack/normalize-ocr-pages.ts`.
  - Command: `npm run textbook:normalize -- --source-id <source-id>`.
  - Normalized output path: `app/tools/textbook-pack/out/normalized/<source-id>/`.
  - Current normalized pages correctly classify sampled pages such as Genki dialogue, Genki vocab index, Quartet workbook exercise, and Quartet Bessatsu/kanji-style pages.
  - Normalized pages preserve OCR text lines, confidence scores, boxes, polygons, active source section, page kind, and warnings for table/grouping cleanup.
- Block grouping status:
  - First-pass block grouper added at `app/tools/textbook-pack/group-ocr-blocks.ts`.
  - Command: `npm run textbook:group -- --source-id <source-id>`.
  - Grouped output path: `app/tools/textbook-pack/out/grouped/<source-id>/`.
  - Current grouping supports vertical prose/dialogue blocks and coordinate-based row grouping for vocab indexes, Bessatsu vocab/kanji, answer-key-like pages, and workbook exercises.
  - Grouping is intentionally heuristic. It is good enough for parser prototyping, but table rows, kanji rows, furigana noise, and workbook blanks still require validation/cleanup before canonical pack generation.
- Genki lesson proof status:
  - First canonical proof generator added at `app/tools/textbook-pack/build-genki-lesson-proof.ts`.
  - Command: `npm run textbook:proof:genki -- --textbook-key genki_1 --lesson 1`.
  - Output path: `app/tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json`.
  - Current proof has full corrected Lesson 1 page coverage:
    - Textbook pages 45-64.
    - Workbook pages 20-26.
    - Workbook page 27 starts the Katakana pre-lesson section before Lesson 2, so it is not part of Lesson 1.
  - Current proof contains 166 content blocks and 111 workbook exercise entries, with source page/coordinate references.
  - Draft OCR-based Lesson 1 extractors now populate:
    - 62 vocabulary rows from the Genki I Lesson 1 vocabulary spread, tagged `draft_table_parse`.
    - 3 grammar candidates: `XはYです`, question sentences with `か`, and `Noun1のNoun2`.
  - The Lesson 1 vocabulary extractor now parses row-grouped OCR tables instead of using fuzzy candidate matching. It also applies a small reading-key cleanup map for common OCR scars in the additional vocabulary table, such as `Lゅふ` -> `しゅふ`.
  - These vocab/grammar entries are proof-quality only; row parsing is deterministic, but source refs, OCR readings, and extracted meanings still need validation against cleaned vocab/grammar tables before becoming gold data.
- Genki pre-lesson proof status:
  - Proof generator now supports `unitType: pre_lesson` with `lessonNumber: 0`.
  - Greetings proof generated at `app/tools/textbook-pack/out/canonical-proofs/genki_1_pre_greetings.json`.
    - Textbook pages 39-43.
    - Workbook pages 17-18.
    - 25 content blocks and 12 exercise entries.
  - Numbers proof generated at `app/tools/textbook-pack/out/canonical-proofs/genki_1_pre_numbers.json`.
    - Textbook page 44.
    - Workbook page 19.
    - 3 content blocks and 3 exercise entries.
- Validation viewer status:
  - Page image renderer added at `app/tools/textbook-pack/render-validation-images.py`.
  - Static validation viewer generator added at `app/tools/textbook-pack/build-validation-viewer.ts`.
  - Commands:
    - `npm run textbook:validation-images`
    - `npm run textbook:validation-viewer`
  - Current Genki I Lesson 1 viewer generated at `app/tools/textbook-pack/out/validation-viewer/genki_1_lesson_1/index.html`.
  - Current viewer contains 27 rendered source pages and 342 extracted items with coordinate overlays.
- Corrections/review status:
  - Corrections initializer added at `app/tools/textbook-pack/init-corrections.ts`.
  - Corrections applier added at `app/tools/textbook-pack/apply-corrections.ts`.
  - Commands:
    - `npm run textbook:corrections:init`
    - `npm run textbook:corrections:apply`
  - Current Genki I Lesson 1 corrections file generated at `app/tools/textbook-pack/corrections/genki_1_lesson_1.corrections.json`.
  - Current reviewed pack generated at `app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json`.
  - Review actions are `pending`, `approved`, `fixed`, and `ignored`. Split/merge cases should ignore the source item and add corrected entries under `additions`.
  - Genki I Lesson 1 vocabulary review pass completed:
    - 50 vocab rows approved.
    - 12 vocab rows fixed for OCR cleanup.
    - 3 grammar rows approved.
    - Raw textbook content blocks were marked ignored and replaced with 18 curated reviewed content blocks covering overview, dialogues, vocab references, grammar notes, expression/culture notes, and practice sections.
    - Raw workbook exercise rows were marked ignored and replaced with 13 curated reviewed exercise entries covering Grammar 1, Grammar 2, Grammar 3, time, telephone numbers, personal questions, and listening exercises.
    - Genki I Lesson 1 now has no pending review items in the reviewed pack.
  - Reviewed-pack validator added at `app/tools/textbook-pack/validate-reviewed-pack.ts`.
  - Command: `npm run textbook:reviewed:validate`.
  - Reviewed image asset cropper added at `app/tools/textbook-pack/crop-reviewed-assets.py`.
  - Command: `npm run textbook:assets:crop`.
  - Reviewed content blocks and exercises can now carry `imageFile` plus `imageSourceRef` so illustrations, charts, diagrams, and activity panels are cropped from the source PDF while preserving the normal text/prompt `sourceRef`.
  - Image asset smoke test completed for Genki I Lesson 1 workbook Listening A picture-choice panel:
    - Asset path: `app/tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1/assets/workbook_listening_a_picture_choices.png`.
    - The reviewed exercise `genki_1_l1_wb_ex_listening_a_picture_choice` references the cropped visual panel.
    - Reviewed-pack validation now checks referenced image assets exist.
  - Genki I Lesson 1 reviewed pack validation passes with 0 errors and 0 warnings:
    - 62 vocabulary entries.
    - 3 grammar entries.
    - 18 content blocks.
    - 13 exercises.

Immediate extraction order:

1. Use the validated Genki I Lesson 1 and Quartet I Lesson 1 packs as the two template loops for expanding lesson-by-lesson.
2. Add listening-script mapping for listening exercises before scaling too far, because tutor explanations need script ground truth.
3. Expand answer-key mapping to Genki I Lesson 1 and then continue Genki I lesson expansion unless a Quartet-specific UI/test need appears first.
4. Keep generic PDF import as fallback; mapped textbooks should use the reviewed-pack loop.

## Workbook Answer-Key Source Map

Status date: 2026-05-11.

- Source-level workbook-to-answer-key ranges are recorded in `app/tools/textbook-pack/source-answer-key-map.json`.
- Genki uses one combined answer key PDF, split into source ranges:
  - `genki_1_workbook` -> `genki_combined_answer_key`
    - Conversation/Grammar workbook answers: PDF pages 34-47.
    - Reading/Writing workbook answers: PDF pages 48-50.
    - Listening scripts: PDF pages 65-73.
  - `genki_2_workbook` -> `genki_combined_answer_key`
    - Conversation/Grammar workbook answers: PDF pages 51-62.
    - Reading/Writing workbook answers: PDF pages 63-64.
    - Listening scripts: PDF pages 74-83.
- Genki answer-key anchor pages OCRed/normalized/grouped:
  - Genki I workbook answer pages 34-35 and listening script page 65.
  - Genki II workbook answer page 51 and listening script page 74.
- Genki I Lesson 1 reviewed pack now includes answer-key refs for all 13 curated workbook exercises and listening-script refs for all 4 listening exercises.
- `genki_1_lesson_1` strict reviewed-pack validation passes with 0 errors and 0 warnings after answer-key mapping.

## Answer Ground-Truth Payloads

Status date: 2026-05-11.

- Exercise schema now supports `answerKey` payloads with:
  - `gradingMode`: `exact`, `sample`, `open_ended`, or `manual`.
  - `sourceText`: OCR-backed answer text extracted from mapped answer-key regions.
  - optional parsed `items` for future fine-grained item-level grading.
- Attachment tool added at `app/tools/textbook-pack/attach-answer-ground-truth.ts`.
- Command: `npm run textbook:answers:attach -- --pack <reviewed-pack>`.
- Reviewed-pack validation now fails if an exercise has answer-key refs but no `answerKey` payload.
- Genki I Lesson 1 answer payloads attached:
  - 13 exercises with answer keys.
  - 6 exact, 5 sample, 2 open-ended.
  - Strict validation passes with 0 errors and 0 warnings.
- Quartet I Lesson 1 answer payloads attached:
  - 15 exercises with answer keys.
  - 3 exact, 10 sample, 2 open-ended.
  - Strict validation passes with 0 errors and 0 warnings.
- This is the first tutor-grading contract: mapped coordinates plus OCR-backed answer text. Fine-grained parsed answer items remain a future refinement.

## Extraction Loop Readiness

Status date: 2026-05-11.

- One-command reviewed-pack finalizer added at `app/tools/textbook-pack/finalize-reviewed-pack.ts`.
  - Command: `npm run textbook:reviewed:finalize -- --proof <canonical-proof> --corrections <corrections-file>`.
  - It applies corrections, crops assets, attaches answer ground-truth payloads, and runs strict validation.
- Reviewed-pack readiness report added at `app/tools/textbook-pack/report-reviewed-packs.ts`.
  - Command: `npm run textbook:reviewed:report`.
  - Current report marks both `genki_1_lesson_1` and `quartet_1_lesson_1` as ready.
- Stable reviewed-pack fingerprint checker added at `app/tools/textbook-pack/check-reviewed-fingerprints.ts`.
  - Command: `npm run textbook:reviewed:fingerprints -- --update`.
  - Check command: `npm run textbook:reviewed:fingerprints`.
  - Current snapshot covers 2 reviewed packs with no drift.
- Validation viewer now includes secondary refs:
  - visual `imageSourceRef` overlays,
  - exercise `answerKeyRef` / `answerKeyRefs` overlays,
  - listening-script refs.
- Reviewed-pack viewers generated:
  - `app/tools/textbook-pack/out/validation-viewer/genki_1_lesson_1_reviewed/index.html`
  - `app/tools/textbook-pack/out/validation-viewer/quartet_1_lesson_1_reviewed/index.html`
- At this point the setup layer for the extraction loop is in place. Remaining work before bulk expansion is product/UX integration or optional fine-grained answer item parsing; the offline lesson extraction loop itself can begin.

## Quartet I Lesson 1 Proof Status

Status date: 2026-05-10.

- OCR captured for:
  - Textbook lesson body pages 27-56.
  - Textbook Bessatsu vocabulary pages 290-293.
  - Textbook Bessatsu kanji pages 316-320.
  - Workbook pages 11-22.
- Normalized and grouped outputs generated for `quartet_1_textbook` and `quartet_1_workbook`.
- Quartet proof generator added at `app/tools/textbook-pack/build-quartet-lesson-proof.ts`.
- Command: `npm run textbook:proof:quartet -- --textbook-key quartet_1 --lesson 1`.
- Current proof generated at `app/tools/textbook-pack/out/canonical-proofs/quartet_1_lesson_1.json`.
- Current proof counts:
  - 100 draft vocabulary rows from Bessatsu.
  - 11 draft grammar patterns.
  - 196 raw textbook content blocks.
  - 253 raw workbook exercise rows.
  - No missing textbook, workbook, vocab, or kanji pages.
- Validation viewer generated at `app/tools/textbook-pack/out/validation-viewer/quartet_1_lesson_1/index.html`.
  - 47 rendered source pages.
  - 560 extracted items.
  - Browser smoke test passed on `http://localhost:8788/`.
- Corrections file generated at `app/tools/textbook-pack/corrections/quartet_1_lesson_1.corrections.json`.
- Initial reviewed pack generated at `app/tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1.json` with all 560 items pending.
- Quartet I Lesson 1 Bessatsu vocabulary review pass completed:
  - 65 vocabulary rows approved.
  - 35 vocabulary rows fixed for OCR cleanup.
- Quartet I Lesson 1 image asset smoke test completed:
  - Asset path: `app/tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1/assets/textbook_reading_1_miyazaki_photo.png`.
  - The reviewed content block `quartet_1_textbook_p28_block_0007` references the cropped visual from textbook page 28.
  - Validation with `--allow-pending` passed with 0 errors before final review completion.
- Quartet I Lesson 1 reviewed pack completed:
  - Reviewed pack path: `app/tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1.json`.
  - 100 vocabulary entries.
  - 11 grammar entries, each with curated explanations and examples.
  - 31 curated content blocks covering overview, Bessatsu vocab/kanji references, reading prep/main readings, reading strategies, grammar notes, writing, speaking, listening, and the Miyazaki photo asset.
  - 15 curated workbook exercise entries replacing 253 raw OCR exercise rows.
  - Strict command `npm run textbook:reviewed:validate -- --pack tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1.json --manifest tools/textbook-pack/out/source-manifest.json` passes with 0 errors and 0 warnings.
- Quartet I Lesson 1 answer-key mapping completed:
  - The proof generator now includes `quartet_1_workbook_answer_key` in reviewed pack sources.
  - Exercise schema supports `answerKeyRefs` for multi-page answer spans while preserving `answerKeyRef` for the primary page.
  - All 15 curated workbook exercise groups now point to answer-key pages 3-14.
  - OCR/normalization/grouping captured `quartet_1_workbook_answer_key` pages 3-14 so answer-key references have grouped page artifacts.
  - Strict reviewed-pack validation still passes with 0 errors and 0 warnings.
