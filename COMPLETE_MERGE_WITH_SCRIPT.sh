#!/bin/bash
# Universal CEFR Grammar Batch Merge Script
# This script merges the conversation-generated batches into output files

OUTPUT_DIR="./app/data/generated/cefr"

# Helper function to merge JSON arrays
merge_json_arrays() {
    local level=$1
    local batch_file=$2
    
    local existing_file="$OUTPUT_DIR/cefr-grammar-$level.json"
    
    if [ ! -f "$existing_file" ]; then
        echo "Error: $existing_file not found"
        return 1
    fi
    
    if [ ! -f "$batch_file" ]; then
        echo "Error: $batch_file not found"
        return 1
    fi
    
    # Use jq to combine arrays and sort by bunproId
    jq -s 'add | sort_by(.bunproId) | to_entries | map(.value | .frequencyRank = .key + 1) | map(del(.key))' \
        "$existing_file" "$batch_file" > "$existing_file.tmp"
    
    if [ $? -eq 0 ]; then
        mv "$existing_file.tmp" "$existing_file"
        local count=$(jq 'length' "$existing_file")
        echo "✅ $level: Merged (now $count total items)"
        return 0
    else
        echo "❌ $level: Merge failed"
        rm -f "$existing_file.tmp"
        return 1
    fi
}

echo "=== CEFR Grammar Batch Merge ==="
echo

# To use this script:
# 1. Save each level's batches as a JSON file in /tmp/
#    - /tmp/a2_batches.json (A2 items 161-179)
#    - /tmp/b1_batches.json (B1 items 1-130)
#    - /tmp/b2_batches.json (B2 items 1-68)
# 
# 2. Run: bash COMPLETE_MERGE_WITH_SCRIPT.sh

if [ -f /tmp/a2_batches.json ]; then
    merge_json_arrays "A2" /tmp/a2_batches.json
else
    echo "⏳ A2: Batch file not found at /tmp/a2_batches.json"
fi

if [ -f /tmp/b1_batches.json ]; then
    merge_json_arrays "B1" /tmp/b1_batches.json
else
    echo "⏳ B1: Batch file not found at /tmp/b1_batches.json"
fi

if [ -f /tmp/b2_batches.json ]; then
    merge_json_arrays "B2" /tmp/b2_batches.json
else
    echo "⏳ B2: Batch file not found at /tmp/b2_batches.json"
fi

echo
echo "Summary:"
for level in A2 B1 B2; do
    if [ -f "$OUTPUT_DIR/cefr-grammar-$level.json" ]; then
        count=$(jq 'length' "$OUTPUT_DIR/cefr-grammar-$level.json")
        echo "  $level: $count items"
    fi
done

