# Source Structure Audit

Audit date: 2026-05-12

This records table-of-contents / outline structure for the current Genki, Quartet, Pair, and in-depth grammar source PDFs. Page numbers are PDF page numbers from the local files, not printed book page numbers unless noted.

Current manifest status: `app/tools/textbook-pack/out/source-manifest.json` is gap-free. Sources now carry `curriculumRole` (`core`, `pair`, `in_depth_grammar`) and `cefrPhase` (`A1`, `A2`, `B1`, `B2`, `global`).

Extraction status as of 2026-05-13:

- `genki_1_textbook`: full 300 DPI OCR capture complete, 393/393 pages normalized and grouped.
- `genki_1_workbook`: full 300 DPI OCR capture complete, 157/157 pages normalized and grouped.
- `genki_combined_answer_key`: full 300 DPI OCR capture complete, 84/84 pages normalized and grouped.
- **All 14 Genki I lesson packs generated** from full OCR base (2026-05-13):
  - Pre-lessons: Greetings, Numbers
  - Lessons 1-12 with full content/exercise extraction
  - Individual reviewed packs ready for corrections

## Genki I Textbook

Source ID: `genki_1_textbook`

Structure:

- Front matter: cover, credits, preface, contents, introduction, Japanese writing system, main characters.
- Conversation and Grammar begins at PDF page 38.
- Pre-lesson study content before Lesson 1:
  - `あいさつ / Greetings`: table-of-contents printed page 30, approximately PDF page 39.
  - `すうじ / Numbers`: table-of-contents printed page 35, approximately PDF page 44.
- Lesson 1 is `あたらしいともだち / New Friends`, PDF page 45, printed page 36.
- Lessons 1-12:
  - L1 New Friends, PDF 45
  - L2 Shopping, PDF 65
  - L3 Making a Date, PDF 91
  - L4 The First Date, PDF 111
  - L5 A Trip to Okinawa, PDF 137
  - L6 A Day in Robert's Life, PDF 155
  - L7 Family Picture, PDF 175
  - L8 Barbecue, PDF 195
  - L9 Kabuki, PDF 219
  - L10 Winter Vacation Plans, PDF 239
  - L11 After the Vacation, PDF 263
  - L12 Feeling Ill, PDF 281
- Reading and Writing begins at PDF page 304, with lesson sections PDF 305-361.
- Appendix/indexes:
  - Grammar Index, PDF 367
  - Vocabulary Index J-E, PDF 369
  - Vocabulary Index E-J, PDF 378
  - Map of Japan, PDF 387
  - Numbers, PDF 389
  - Conjugation Chart, PDF 391

Pipeline note: `Greetings` and `Numbers` must be modeled as pre-lesson content, not as Lesson 1. `New Friends` is Lesson 1.

## Genki I Workbook

Source ID: `genki_1_workbook`

Structure:

- Conversation and Grammar begins at PDF page 13.
- Pre-lesson/kana content before and around Lesson 1:
  - Japanese Writing System-1 Hiragana, PDF 15
  - Greetings, PDF 17
  - Numbers, PDF 19
  - Lesson 1, PDF 20
  - Japanese Writing System-2 Katakana, PDF 27
- Lessons 1-12:
  - L1 PDF 20
  - L2 PDF 29
  - L3 PDF 36
  - L4 PDF 45
  - L5 PDF 54
  - L6 PDF 63
  - L7 PDF 73
  - L8 PDF 82
  - L9 PDF 91
  - L10 PDF 100
  - L11 PDF 109
  - L12 PDF 115
- Reading and Writing begins at PDF page 123, with lesson sections PDF 125-155.

Pipeline note: workbook pre-lesson/kana sections should be linked to the same pre-lesson study units where appropriate.

## Genki II Textbook

Source ID: `genki_2_textbook`

Structure:

- Front matter: cover, credits, preface, contents, introduction, main characters.
- Conversation and Grammar begins at PDF page 29.
- Lessons 13-23:
  - L13 Looking for a Part-time Job, PDF 30
  - L14 Valentine's Day, PDF 54
  - L15 A Trip to Nagano, PDF 78
  - L16 Lost and Found, PDF 100
  - L17 Grumble and Gossip, PDF 122
  - L18 John's Part-time Job, PDF 144
  - L19 Meeting the Boss, PDF 168
  - L20 Mary Goes Shopping, PDF 188
  - L21 Burglar, PDF 214
  - L22 Education in Japan, PDF 236
  - L23 Good-bye, PDF 258
- Reading and Writing begins at PDF page 281, with lesson sections PDF 282-348.
- Appendix/indexes:
  - Grammar Index, PDF 356
  - Vocabulary Index J-E, PDF 360
  - Vocabulary Index E-J, PDF 376
  - Map of Japan, PDF 392
  - Numbers, PDF 394
  - Conjugation Chart, PDF 396

## Genki II Workbook

Source ID: `genki_2_workbook`

Structure:

- Conversation and Grammar begins at PDF page 13.
- Lessons 13-23:
  - L13 PDF 15
  - L14 PDF 25
  - L15 PDF 32
  - L16 PDF 39
  - L17 PDF 48
  - L18 PDF 55
  - L19 PDF 64
  - L20 PDF 73
  - L21 PDF 83
  - L22 PDF 92
  - L23 PDF 101
- Reading and Writing begins at PDF page 113, with lesson sections PDF 115-135.

## Genki Combined Answer Key

Source ID: `genki_combined_answer_key`

Structure:

- Genki I textbook answers:
  - Conversation and Grammar, PDF 4
  - Reading and Writing, PDF 17
- Genki II textbook answers:
  - Conversation and Grammar, PDF 20
  - Reading and Writing, PDF 31
- Genki I workbook answers:
  - Conversation and Grammar, PDF 34
  - Reading and Writing, PDF 48
- Genki II workbook answers:
  - Conversation and Grammar, PDF 51
  - Reading and Writing, PDF 63
- Workbook listening scripts:
  - Genki I starts at PDF 65
  - Genki II starts at PDF 74

Pipeline note: this file is broader than a workbook answer key; it contains textbook answers, workbook answers, and listening scripts.

## Quartet I Textbook

Source ID: `quartet_1_textbook`

Structure:

- Front matter and book instructions through PDF page 26.
- Lessons 1-6 each split into Reading, Writing, Speaking, Listening:
  - L1 PDF 27: Reading 28, Writing 42, Speaking 44, Listening 55
  - L2 PDF 57: Reading 58, Writing 76, Speaking 78, Listening 90
  - L3 PDF 93: Reading 94, Writing 108, Speaking 110, Listening 123
  - L4 PDF 125: Reading 126, Writing 142, Speaking 144, Listening 156
  - L5 PDF 159: Reading 160, Writing 175, Speaking 178, Listening 192
  - L6 PDF 195: Reading 196, Writing 214, Speaking 216, Listening 228
- Brush-up:
  - Elementary grammar check, PDF 232
  - Kanji challenge, PDF 256
- Listening answers/scripts, PDF 268.
- Grammar expression index, PDF 275.
- Word index, PDF 276.
- Bessatsu/Supplement begins at PDF 287:
  - Vocabulary lists / target words with sample sentences, PDF 289, lesson subsections PDF 290-311.
  - Kanji lists, PDF 315, lesson subsections PDF 316-341.
  - Kanji challenge pages PDF 346-351.

Pipeline note: vocab and kanji unlock data should come primarily from the Bessatsu sections, not the lesson body.

## Quartet I Workbook

Source ID: `quartet_1_workbook`

Structure:

- Workbook instructions through PDF page 8.
- Lessons 1-6 each split into:
  - Reading 1 work
  - Reading 2 work
  - Grammar/expression work
  - A basic practice
  - B summary practice
  - C oral practice
- Lesson starts:
  - L1 PDF 11
  - L2 PDF 23
  - L3 PDF 35
  - L4 PDF 47
  - L5 PDF 59
  - L6 PDF 71
- Brush-up:
  - Elementary grammar check work, PDF 87
  - Kanji challenge work, PDF 101

## Quartet I Workbook Answer Key

Source ID: `quartet_1_workbook_answer_key`

Structure:

- Lessons 1-6 workbook answers, PDF 3-75.
- Elementary grammar check work answers, PDF 77-89.
- Kanji challenge work answers, PDF 91-102.

Pipeline note: this should be named and modeled specifically as a workbook answer key.

## Quartet II Textbook

Source ID: `quartet_2_textbook`

Structure:

- Front matter and book instructions through PDF page 26.
- Lessons 7-12 each split into Reading, Writing, Speaking, Listening:
  - L7 PDF 27: Reading 28, Writing 43, Speaking 46, Listening 57
  - L8 PDF 59: Reading 60, Writing 75, Speaking 78, Listening 89
  - L9 PDF 91: Reading 92, Writing 108, Speaking 110, Listening 121
  - L10 PDF 123: Reading 124, Writing 143, Speaking 146, Listening 157
  - L11 PDF 159: Reading 160, Writing 174, Speaking 176, Listening 187
  - L12 PDF 189: Reading 190, Writing 206, Speaking 210, Listening 223
- Brush-up:
  - Challenge for Advanced, PDF 226
  - Kanji challenge, PDF 252
- Listening answers/scripts, PDF 264.
- Grammar expression index, PDF 272.
- Word index, PDF 274.
- Bessatsu/Supplement begins at PDF 285:
  - Vocabulary lists / target words with sample sentences, PDF 287, lesson subsections PDF 288-313.
  - Kanji lists, PDF 319, lesson subsections PDF 320-345.
  - Kanji challenge pages PDF 350-355.

## Quartet II Workbook

Source ID: `quartet_2_workbook`

Structure:

- Workbook instructions through PDF page 8.
- Lessons 7-12 each split into reading work and grammar/expression work:
  - L7 PDF 11
  - L8 PDF 23
  - L9 PDF 33
  - L10 PDF 43
  - L11 PDF 53
  - L12 PDF 63
- Brush-up:
  - Challenge for Advanced work, PDF 77
  - Kanji challenge work, PDF 91

## Quartet II Workbook Answer Key

Source ID: `quartet_2_workbook_answer_key`

Structure:

- Cover identifies it as Workbook Answers.
- Starts with Lesson 7 workbook-answer material.
- No PDF outline is available in the current file, so page-section boundaries must be inferred from OCR/content during the answer-key mapping pass.

Pipeline note: this should be named and modeled specifically as a workbook answer key.

## Pair Sources

These are not the first extraction target. They should be linked after Core source structure is stable so the roadmap can use them for practice, social/contextual validation, and can-do checks.

### Marugoto A1 Katsudo

Source ID: `marugoto_a1_textbook`

- Curriculum role: `pair`
- CEFR phase: `A1`
- Page count: 147
- Roadmap use: practical/social A1 validation paired with Genki I.

### Marugoto A2 Katsudo

Source ID: `marugoto_a2_textbook`

- Curriculum role: `pair`
- CEFR phase: `A2`
- Page count: 186
- Roadmap use: practical/social A2 validation paired with Genki II.

### Marugoto B1

Source ID: `marugoto_b1_textbook`

- Curriculum role: `pair`
- CEFR phase: `B1`
- Page count: 273
- Roadmap use: practical/social B1 validation paired with Quartet I.

### Tobira

Source ID: `tobira_textbook`

- Curriculum role: `pair`
- CEFR phase: `B2`
- Page count: 428
- Roadmap use: B2 reading/content bridge paired with Quartet II.

## In-Depth Grammar Preset

### Maynard/Yanard Grammar Reference

Source ID: `maynard_grammar_grammar_reference`

- Curriculum role: `in_depth_grammar`
- CEFR phase: `global`
- Page count: 398
- Role: reusable grammar explanation preset layer, not a normal lesson-by-lesson textbook.
- Roadmap use: explain grammar logic, nuance, and why/how patterns work across Core and Pair material.
