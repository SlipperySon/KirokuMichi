#!/bin/bash
# Auto-completion pipeline: runs normalize → group → build for all three sources
# Call after OCR tasks complete

set -e
cd "$(git rev-parse --show-toplevel)" || exit 1

echo "🚀 Starting auto-completion pipeline..."
echo ""

SOURCES=("marugoto_a1_textbook" "genki_2_textbook" "genki_2_workbook")
TEXTBOOK_KEYS=("marugoto_a1" "genki_2" "genki_2")

for i in "${!SOURCES[@]}"; do
  source_id="${SOURCES[$i]}"
  textbook_key="${TEXTBOOK_KEYS[$i]}"

  echo "───────────────────────────────────────"
  echo "📦 Processing: $source_id"
  echo "───────────────────────────────────────"

  # Step 1: Normalize
  echo "  📋 Normalizing OCR..."
  npx tsx app/tools/textbook-pack/normalize-ocr-pages.ts --source-id "$source_id" > /dev/null

  # Step 2: Group
  echo "  🔗 Grouping blocks..."
  npx tsx app/tools/textbook-pack/group-ocr-blocks.ts --source-id "$source_id" > /dev/null

  echo "  ✓ Complete"
done

echo ""
echo "───────────────────────────────────────"
echo "📖 Building lesson packs..."
echo "───────────────────────────────────────"

# Build lessons for each textbook
for key in "marugoto_a1" "genki_2"; do
  echo "  Building $key lessons..."
  npx tsx app/tools/textbook-pack/build-all-textbook-lessons.ts "$key" > /dev/null
  echo "  ✓ $key complete"
done

echo ""
echo "───────────────────────────────────────"
echo "📤 Splitting into reviewed packs..."
echo "───────────────────────────────────────"

# Split Genki II lessons into individual reviewed packs
npx tsx app/tools/textbook-pack/split-lessons-to-reviewed.ts
npx tsx app/tools/textbook-pack/split-lessons-to-reviewed.ts --textbook genki_2 > /dev/null

echo ""
echo "✅ Pipeline complete!"
echo ""
echo "Generated outputs:"
echo "  - Marugoto A1: out/canonical-proofs/marugoto_a1_all_lessons.json"
echo "  - Genki II: out/canonical-proofs/genki_2_all_lessons.json"
echo "  - Reviewed packs: out/reviewed-packs/marugoto_a1_lesson_1.json"
echo "  - Reviewed packs: out/reviewed-packs/genki_2_lesson_13.json ... _23.json"
echo ""
echo "Next steps:"
echo "  1. Manual corrections on reviewed packs (vocab, grammar, content blocks)"
echo "  2. Answer-key linking (exercise ID → answer-key page/coordinates)"
echo "  3. Validation & testing"
