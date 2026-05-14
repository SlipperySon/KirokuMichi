# Lesson Structure & Anki Unlock System

## Overview

KirokuMichi uses a **lesson-based unlock system** where:
1. User selects a textbook (Genki I, Marugoto A1, etc.)
2. User starts Lesson 1
3. App checks what vocabulary/grammar/exercises are in Lesson 1
4. Matching Anki cards **unlock automatically** for study
5. User completes textbook + workbook lessons
6. New cards unlock for next lesson

## Lesson Structure

All lessons are normalized and structured in `/app/data/generated/lesson-structure.json`:

```json
{
  "normalized_id": "genki_1_1",
  "series": "Genki I",
  "lesson_number": 1,
  "textbook": {
    "original_id": "genki_1_1",
    "vocab": 2,
    "grammar": 18,
    "dialogues": 158,
    "exercises": 481
  },
  "workbook": {
    "original_id": "genki_1_1",
    "vocab": 0,
    "grammar": 2,
    "dialogues": 0,
    "exercises": 24
  },
  "content": {
    "vocab": 4,
    "grammar": 20,
    "dialogues": 158,
    "exercises": 505
  }
}
```

## How It Works

### Step 1: Load Lesson Structure
```typescript
import { lessonStructureService } from './content/lessonNormalization'

// Get all Genki I lessons
const genkiI = await lessonStructureService.getLessonsBySeries('Genki I')
// Returns: [genki_1_1, genki_1_2, ..., genki_1_12]

// Get specific lesson
const lesson1 = await lessonStructureService.getLesson('genki_1_1')
// Returns: { normalized_id, series, lesson_number, textbook, workbook, content }
```

### Step 2: Match Anki Cards to Lesson
When user unlocks Lesson 1:
1. Look up lesson vocabulary (2 items for Genki I L1)
2. Look up lesson grammar (18 patterns)
3. Search imported Anki cards for matching terms
4. Unlock matching cards

```typescript
// Pseudo-code for unlock logic
const lesson = await lessonStructureService.getLesson('genki_1_1')

// From Anki deck, find cards containing these terms:
const cardMatches = anki_cards.filter(card => 
  lesson.content.vocab_terms.includes(card.front) ||
  lesson.content.grammar_patterns.includes(card.front)
)

// Unlock these cards
cardMatches.forEach(card => card.unlock())
```

### Step 3: Track Progress
- User studies unlocked cards
- Completes textbook lessons
- Completes workbook exercises
- Moves to next lesson
- New cards unlock

## Series Structure

### Genki I & II
- **Lessons**: 12 each (Lesson 1-12)
- **Textbook**: Vocabulary + Grammar + Dialogues + Exercises
- **Workbook**: Grammar reinforcement + Exercises
- **Total Lessons**: 24 (Genki I + II combined)

### Marugoto Series
- **A1**: 8 lessons
- **A2**: 8 lessons
- **B1**: 8 lessons
- **Total Lessons**: 24 (across all levels)

### Quartet Series
- **Level 1**: 12 lessons
- **Level 2**: 12 lessons
- **Total Lessons**: 24

### Tobira
- Advanced content (advanced lesson structure)

## Data Files

| File | Purpose | Size |
|------|---------|------|
| `lesson-structure.json` | Maps all 96 lessons with textbook/workbook references | 50 KB |
| `lessonNormalization.ts` | Service for loading/normalizing lessons | 4 KB |
| `genki_1_textbook-comprehensive.json` | Genki I textbook vocabulary/grammar/exercises | 1.9 MB |
| `genki_1_workbook-comprehensive.json` | Genki I workbook grammar/exercises | 360 KB |

## Total Lessons

- **Genki I**: 12 lessons
- **Genki II**: 12 lessons  
- **Marugoto A1**: 8 lessons
- **Marugoto A2**: 8 lessons
- **Marugoto B1**: 8 lessons
- **Quartet 1**: 12 lessons
- **Quartet 2**: 12 lessons
- **Tobira**: 14 lessons

**Total**: 96 lessons with full textbook/workbook alignment

## Usage Examples

### Get Lesson Content
```typescript
const lesson = await lessonStructureService.getLesson('genki_1_1')

console.log(`${lesson.series} - Lesson ${lesson.lesson_number}`)
console.log(`Vocabulary: ${lesson.content.vocab}`)
console.log(`Grammar patterns: ${lesson.content.grammar}`)
console.log(`Exercises: ${lesson.content.exercises}`)
```

### Get All Lessons for a Series
```typescript
const genkiLessons = await lessonStructureService.getLessonsBySeries('Genki I')
// Returns array of 12 lessons with all content references
```

### Check Textbook/Workbook Availability
```typescript
const lesson = await lessonStructureService.getLessonWithBoth('genki_1_1')

if (lesson.hasTextbook) {
  console.log('Textbook content available')
}
if (lesson.hasWorkbook) {
  console.log('Workbook exercises available')
}
```

## Normalization

The lesson IDs from OCR extraction are normalized:

| Raw ID | Normalized | Series | Lesson |
|--------|-----------|--------|--------|
| `1_textbook_genki_1_1` | `genki_1_1` | Genki I | 1 |
| `genki_1_1` | `genki_1_1` | Genki I | 1 |
| `1_workbook_genki_1_1` | `genki_1_1` | Genki I | 1 |
| `marugoto_a1_1` | `marugoto_a1_1` | Marugoto A1 | 1 |
| `quartet_1_1` | `quartet_1_1` | Quartet 1 | 1 |

Use `normalizeLessonId()` function to convert any ID to standard format:
```typescript
import { normalizeLessonId } from './content/lessonNormalization'

const normalized = normalizeLessonId('1_textbook_genki_1_5')
// Returns: 'genki_1_5'
```

## Next Steps

1. **Create Unlock Logic**
   - When user starts lesson, look up vocabulary/grammar
   - Query Anki cards for matching terms
   - Mark cards as "unlocked"

2. **Create Lesson UI**
   - Show textbook content
   - Show workbook exercises
   - Display unlocked cards count
   - Track progress

3. **Create Study Flow**
   - Display unlocked cards
   - Track SM2 scheduling
   - Show lesson completion
   - Auto-unlock next lesson

4. **Optional: Vocabulary Matching**
   - For better matching, create mapping of Anki card content to lesson vocabulary
   - Handle variations (different readings, multiple meanings)
   - Fallback to basic text matching if exact match fails
