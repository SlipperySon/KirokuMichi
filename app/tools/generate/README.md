# Phase 5: Content Generation Pipeline

This directory contains scripts to generate JLPT content for KirokuMichi.

## Overview

The pipeline populates your database with:
- **Kanji**: 2,136 characters with JLPT levels (from davidluzgouveia/kanji-data)
- **Vocabulary**: 10,000+ words from JLPT Anki decks
- **Grammar**: N5-N1 patterns with AI-generated explanations
- **Quiz Questions**: AI-generated fill-in-the-blank and multiple-choice questions

## Quick Start

### 1. Extract Kanji (automatic)
```bash
npm run generate
```

This downloads kanji data and saves it as JSON.

### 2. Extract Vocabulary (manual)

You need an JLPT Anki deck file (.apkg). Popular options:
- [JLPT N5-N1 Egg Rolls Deck](https://github.com/5mdld/anki-jlpt-decks) (~10,000 cards)
- [Genki Textbook Decks](https://ankiweb.net) (search "JLPT")

Download a `.apkg` file, then:
```bash
tsx tools/generate/extract-vocab.ts path/to/your-deck.apkg
```

This extracts vocabulary and saves it as JSON.

### 3. Extract Grammar (automatic)
```bash
npm run generate
```

Creates seed grammar data. The data is minimal but will be enriched in step 4.

### 4. Generate Quiz Questions (optional, requires API key)

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Then generate questions:
```bash
tsx tools/generate/generate-quiz.ts
```

This uses Claude to create JLPT-style questions based on grammar patterns.

### 5. Generate Example Sentences (optional, requires API key)

Enrich vocabulary with example sentences:
```bash
tsx tools/generate/generate-examples.ts
```

### 6. Import to Database

Generate SQL import statements:
```bash
tsx tools/generate/import-to-db.ts
```

This creates `app/data/generated/import.sql`. The SQL file is ready to import.

## Files

### Extractors
- **extract-kanji.ts** - Downloads davidluzgouveia/kanji-data JSON and converts to card format
- **extract-vocab.ts** - Extracts notes from Anki .apkg files
- **extract-grammar.ts** - Creates grammar seed data

### Generators
- **generate-quiz.ts** - Uses Claude API to create fill-blank and MC questions
- **generate-examples.ts** - Uses Claude API to create example sentences

### Utilities
- **import-to-db.ts** - Generates SQL insert statements from all JSON files
- **types.ts** - Shared TypeScript interfaces
- **pipeline.ts** - Orchestration script (runs all steps)

## Output

All generated files are saved to `app/data/generated/`:
- `kanji-cards.json` - Kanji with readings and JLPT levels
- `vocab-*.json` - Vocabulary from your Anki deck
- `grammar-points.json` - Grammar patterns
- `quiz-questions.json` - AI-generated questions (optional)
- `import.sql` - SQL insert statements

## Database Import

After running the generation pipeline, you have three options:

### Option 1: Use SQLite CLI (recommended)
`/data/generated/import.sql` is intentionally blocked from HTTP serving.
Import only from the local filesystem:

```bash
sqlite3 data/kiroku.db < data/generated/import.sql
```

### Option 3: Manual Import via App
Copy the SQL statements and paste them into your database tool.

## Grammar Data Quality

The `grammar-points.json` includes:
- **Title**: Pattern name (e.g., "Conditional 〜たら")
- **Pattern**: Grammatical structure  
- **Meaning**: English translation
- **Explanation**: Basic description
- **Examples**: Sample sentences with Japanese/English

Quality improves with the optional `generate-quiz.ts` and `generate-examples.ts` steps, which enrich the data via Claude.

## Vocabulary Data Quality

Vocabulary extracted from Anki decks includes:
- **Front**: Japanese word/kanji
- **Back**: English meaning
- **Reading**: Hiragana reading
- **JLPT Level**: Inferred from deck tags (N5-N1)

The optional `generate-examples.ts` adds example sentences for context.

## Quiz Questions

Generated questions include:
- **Prompt**: Sentence with a blank (___) to fill
- **Options**: 4 multiple-choice answers
- **Answer**: Correct option
- **Explanation**: Why the answer is correct

Questions are tied to grammar patterns and auto-graded.

## Troubleshooting

### "kanji-data download failed"
- Check your internet connection
- The GitHub repo might be down — try manually downloading from [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data)

### "API key not found" when generating quiz
```bash
export ANTHROPIC_API_KEY=sk-ant-...
tsx tools/generate/generate-quiz.ts
```

### "vocab-*.json files not found"
You need to run:
```bash
tsx tools/generate/extract-vocab.ts path/to/your-deck.apkg
```

### SQL import fails
Check that:
1. The app is running (`npm run dev`)
2. The database exists in `app/data/kiroku.db`
3. The SQL is syntactically valid

## Next Steps

After importing content:
1. Start the app: `npm run dev`
2. Navigate to `/jlpt` to see grammar lessons
3. Browse vocabulary by level
4. Take practice and simulated tests
5. Try vocab in SRS mode from `/study`

## Architecture Notes

- **Separation of concerns**: Extraction, generation, and import are separate scripts
- **JSON intermediate format**: All data flows through JSON for validation and debugging
- **SQL export**: Final SQL file can be inspected before import
- **No native dependencies**: Uses pure JavaScript libraries (jszip, sql.js)

## Performance

- **Kanji extraction**: ~1-2 seconds (network dependent)
- **Vocab extraction**: 10-20 seconds (depends on deck size)
- **Quiz generation**: ~1-2 minutes for 10 grammar points (API dependent)
- **Example generation**: ~2-5 minutes for 20 vocab words (API dependent)
- **SQL generation**: <1 second

Total pipeline: ~10-20 minutes with API calls, ~30 seconds without.
