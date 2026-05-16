#!/bin/bash
# Post-OCR pipeline for Maynard Grammar Reference
# Run from project root: bash app/tools/textbook-pack/run-maynard-pipeline.sh
set -e

SOURCE_ID="maynard_grammar_grammar_reference"
PROJECT_ROOT="/Users/Skipp/Projects/KirokuMichi"
cd "$PROJECT_ROOT"

echo "🔧 Maynard Grammar Pipeline"
echo "  Source: $SOURCE_ID"
echo ""

# Step 1: Normalize OCR pages
echo "📋 Step 1: Normalizing OCR pages..."
npx --prefix app tsx app/tools/textbook-pack/normalize-ocr-pages.ts \
  --source-id "$SOURCE_ID"
echo "✓ Normalization complete"

# Step 2: Group OCR blocks
echo ""
echo "🔗 Step 2: Grouping OCR blocks..."
npx --prefix app tsx app/tools/textbook-pack/group-ocr-blocks.ts \
  --source-id "$SOURCE_ID"
echo "✓ Grouping complete"

# Step 3: Build grammar reference JSON
echo ""
echo "📖 Step 3: Building Maynard grammar reference..."
npx --prefix app tsx app/tools/textbook-pack/build-maynard-grammar.ts
echo "✓ Build complete"

echo ""
echo "🎉 Pipeline finished! Output: app/tools/textbook-pack/out/comprehensive/maynard_grammar-comprehensive.json"
