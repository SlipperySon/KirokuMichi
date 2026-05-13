# Textbook Pack Pipeline

This folder is for the offline canonical pack generation path for mapped textbooks.

The app's generic PDF importer is still useful for unknown PDFs, but Genki and Quartet should be built through this deterministic pack pipeline:

1. Generate a source manifest from the local source PDFs.
2. Run Japanese-aware OCR/layout extraction across the full source PDFs.
3. Split and classify extracted pages by lesson/supplement/answer-key outline hints.
4. Normalize output into the canonical JSON schema.
5. Validate schema, source coverage, duplicates, page references, and stable output diffs.
6. Encrypt final packs for app distribution.

Do not skip front matter or begin at a "useful" page for canonical packs. The older Genki page 14/page 12 starts were only for quick generic-import tests. The pack pipeline should capture every page first, then filter or classify later.

## Current Commands

Install the local OCR environment from the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r app/tools/textbook-pack/requirements-ocr.txt
```

```bash
npm run textbook:manifest
```

Outputs:

```text
tools/textbook-pack/out/source-manifest.json
```

```bash
npm run textbook:ocr -- --source-id genki_1_textbook
```

By default this captures the full source PDF into:

```text
tools/textbook-pack/out/ocr/<source-id>/
```

For smoke tests only, limit the run:

```bash
npm run textbook:ocr -- --source-id genki_1_textbook --max-pages 1 --dpi 120
```

Or sample non-contiguous representative pages:

```bash
npm run textbook:ocr -- --source-id genki_1_textbook --pages 45,46,369 --dpi 120
```

The OCR runner defaults to PaddleOCR PP-OCRv5 mobile detection/recognition models for CPU speed. Use server models only for targeted quality comparisons.

Normalize captured raw OCR into page-level classified JSON:

```bash
npm run textbook:normalize -- --source-id genki_1_textbook
```

Outputs:

```text
tools/textbook-pack/out/normalized/<source-id>/
```

Group normalized OCR lines into first-pass page blocks:

```bash
npm run textbook:group -- --source-id genki_1_textbook
```

Outputs:

```text
tools/textbook-pack/out/grouped/<source-id>/
```

Build the first Genki canonical lesson proof from grouped blocks:

```bash
npm run textbook:proof:genki -- --textbook-key genki_1 --lesson 1
```

Build the first Quartet canonical lesson proof from grouped blocks and Bessatsu pages:

```bash
npm run textbook:proof:quartet -- --textbook-key quartet_1 --lesson 1
```

Outputs:

```text
tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json
```

Build a Genki pre-lesson proof:

```bash
npm run textbook:proof:genki -- --textbook-key genki_1 --unit pre_lesson --slug greetings
npm run textbook:proof:genki -- --textbook-key genki_1 --unit pre_lesson --slug numbers
```

Render proof page images and build the validation viewer:

```bash
npm run textbook:validation-images
npm run textbook:validation-viewer
```

Outputs:

```text
tools/textbook-pack/out/validation-viewer/genki_1_lesson_1/index.html
```

The generated viewer is static. Serve its output folder locally to inspect page images, extracted items, and coordinate overlays in a browser.

Create the review/corrections file for the proof:

```bash
npm run textbook:corrections:init
```

Outputs:

```text
tools/textbook-pack/corrections/genki_1_lesson_1.corrections.json
```

Each correction has an `action`:

- `pending`: not reviewed yet.
- `approved`: verified as correct.
- `fixed`: verified after applying `replacement` fields.
- `ignored`: remove this proof item from the reviewed pack.

For split/merge cases, mark the original item as `ignored` and add replacement entries under `additions`.

Apply corrections into a reviewed pack:

```bash
npm run textbook:corrections:apply
```

Outputs:

```text
tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json
```

Crop reviewed image assets referenced by `imageFile` / `imageSourceRef`:

```bash
npm run textbook:assets:crop
```

Reviewed content blocks and exercises can point to cropped page regions for illustrations, charts, diagrams, and activity panels. Keep the main `sourceRef` on the text/prompt when useful, and use `imageSourceRef` for the visual crop.

Validate the reviewed pack before using it as a template for the next book/lesson:

```bash
npm run textbook:reviewed:validate
```

The validator checks review status, duplicate IDs, source references, coordinate bounds, grammar target links, referenced image asset files, and basic lesson counts.

Exercises can include answer-key mappings:

- `answerKeyRef`: primary answer-key page/region.
- `answerKeyRefs`: all answer-key pages/regions when a curated exercise group spans multiple answer pages.
- `answerKey`: extracted ground-truth payload with grading mode and source text from the mapped answer-key region.

Answer-key sources must be listed in `pack.sources`, and their referenced pages should be OCRed/normalized/grouped so validation can prove the page artifacts exist.

Workbook-to-answer-key source ranges are recorded in:

```text
tools/textbook-pack/source-answer-key-map.json
```

Genki I and Genki II share `genki_combined_answer_key`, with separate workbook answer and listening-script ranges.

Attach answer-key source text to reviewed exercises:

```bash
npm run textbook:answers:attach -- --pack tools/textbook-pack/out/reviewed-packs/genki_1_lesson_1.json
```

This is the first grading payload layer: OCR-backed answer text plus a grading mode (`exact`, `sample`, `open_ended`, or `manual`). Fine-grained item parsing can be layered on top later.

Finalize a reviewed pack after editing its corrections file:

```bash
npm run textbook:reviewed:finalize -- \
  --proof tools/textbook-pack/out/canonical-proofs/genki_1_lesson_1.json \
  --corrections tools/textbook-pack/corrections/genki_1_lesson_1.corrections.json
```

This applies corrections, crops referenced visual assets, attaches answer-key ground truth, and runs strict reviewed-pack validation.

Report all reviewed packs:

```bash
npm run textbook:reviewed:report
```

Update and check stable reviewed-pack fingerprints:

```bash
npm run textbook:reviewed:fingerprints -- --update
npm run textbook:reviewed:fingerprints
```

Reviewed-pack validation viewers can be generated from reviewed packs, not only raw proofs:

```bash
npm run textbook:validation-images -- --proof tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1.json --out tools/textbook-pack/out/validation-viewer/quartet_1_lesson_1_reviewed
npm run textbook:validation-viewer -- --proof tools/textbook-pack/out/reviewed-packs/quartet_1_lesson_1.json --out tools/textbook-pack/out/validation-viewer/quartet_1_lesson_1_reviewed
```

## OCR/Layout Direction

Use the manifest as the input map for the real extraction engines:

- PaddleOCR / PP-OCR Japanese for printed Japanese and English OCR.
- Marker or MinerU for layout structure, tables, images, and coordinates.
- Manga OCR only as an optional targeted comparison for Japanese-heavy chunks or furigana cleanup.

Do not bulk-generate canonical packs from the current generic AI importer. The manifest and schema exist so the better OCR/layout pipeline has a stable target.
