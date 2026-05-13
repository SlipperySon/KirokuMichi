# Marugoto-to-Genki Curriculum Linking

## Overview

The `curriculum-marugoto-links.json` file provides optional practice suggestions for Genki lessons using Marugoto activities. These links are:

- **Optional** — User can skip/deny suggestions
- **Non-blocking** — No progression halted if Marugoto not unlocked
- **External** — Genki lessons remain completely unchanged
- **Gracefully degraded** — Hidden if Marugoto textbooks not unlocked
- **Concept-based** — Matched by vocabulary and grammar overlap

## File Format

```json
{
  "schemaVersion": 1,
  "description": "...",
  "generatedAt": "2026-05-14T...",
  "links": {
    "genki_1_lesson_1": {
      "lessonNumber": 1,
      "marugotoActivities": [
        {
          "blockId": "block_0024",
          "pageNumber": 6,
          "blockType": "text_block",
          "preview": "ジョイさん ヤンさん たなかさん...",
          "overlapScore": 1.0
        }
      ]
    }
  }
}
```

## Using in the App

### Query Pattern

```typescript
// Get practice suggestions for a lesson
const suggestions = curriculumLinks.links[lessonId]?.marugotoActivities || []

// Filter by unlock status
const availableSuggestions = unlocked('marugoto')
  ? suggestions.slice(0, 5)  // Show top 5
  : []  // Show nothing if not unlocked
```

### UI Flow

```
┌─────────────────────────────────────┐
│ Genki I Lesson 1 Complete           │
├─────────────────────────────────────┤
│ [Next Lesson →]                     │
│                                     │
│ 💡 Tip: Practice with Marugoto?     │
│ ┌────────────────────────────────┐  │
│ │ Activity: Self-introduction    │  │
│ │ Match: ✓ Names, greetings      │  │
│ │ [Try Activity] [Skip]          │  │
│ └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Ungraceful Handling (Marugoto Not Unlocked)

```typescript
if (!unlocked('marugoto')) {
  // Simply don't show the suggestions
  return null
}
```

The lesson progression is **never blocked**.

## Linking Statistics

- **Total Lessons Linked:** 25 (14 Genki I + 11 Genki II)
- **Total Activities Linked:** 72
- **A1 Core (Genki I):** 32 activities
- **A2 Core (Genki II):** 40 activities
- **Avg Overlap Score:** 0.77 (on scale of 0–1.0)

### Coverage

Some lessons have stronger Marugoto matches than others:
- **High Coverage** (Lessons 1, 2, 9, 11, 13, 15, 17, 19, 21): 8 activities each
- **No Coverage** (Lessons 3–8, 10, 12, 14, 16, 18, 20, 22–23): No strong matches

This is expected—Marugoto's content naturally aligns better with certain Genki lessons based on topic and vocabulary overlap.

## Regenerating Links

If lesson packs are updated, regenerate links:

```bash
npx tsx app/tools/textbook-pack/build-marugoto-links.ts
```

The algorithm:
1. Extracts vocabulary and grammar from each Genki lesson
2. Extracts content blocks from Marugoto pages
3. Scores matches by vocabulary/grammar overlap
4. Returns top 8 activities per lesson

## Architecture Notes

- **Fully external** — `curriculum-marugoto-links.json` is a separate file
- **Non-invasive** — Zero modifications to Genki lesson packs
- **Composable** — Can be extended with other textbook pairs (Quartet, Tobira, etc.)
- **Graceful degradation** — If not loaded, app simply shows no suggestions

## Future Enhancements

- [ ] Weight by lesson difficulty/progression
- [ ] Add user interaction signals (clicked activities, completion)
- [ ] Generate variant links based on user preferences
- [ ] Extend to other textbook pairs (Quartet → ?, Tobira → ?)
