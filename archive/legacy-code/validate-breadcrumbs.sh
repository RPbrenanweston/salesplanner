#!/bin/bash

# Breadcrumb Validation Script (v4 - Single pass)
# Uses find + xargs to avoid while loop issues

REPO_ROOT=$(pwd)
ISSUES_FILE="breadcrumb-issues.txt"
SUMMARY_FILE="breadcrumb-summary.txt"

> "$ISSUES_FILE"
> "$SUMMARY_FILE"

echo "🔍 Validating breadcrumbs across codebase..."
echo ""

# Count Schema C breadcrumbs
SCHEMA_C_FILES=$(find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l "// @crumb" {} \;)
TOTAL_FILES=$(echo "$SCHEMA_C_FILES" | wc -l)

echo "Validating $TOTAL_FILES files (Schema C format)..." | tee -a "$SUMMARY_FILE"
echo "" | tee -a "$SUMMARY_FILE"

HAZARD_ERRORS=0
EDGE_ERRORS=0
WHY_ERRORS=0
EDGE_TARGET_ERRORS=0

# Count totals
TOTAL_HAZARDS=$(find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l "// @crumb" {} \; | xargs grep "// hazard:" 2>/dev/null | wc -l)
TOTAL_EDGES=$(find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l "// @crumb" {} \; | xargs grep "// edge:" 2>/dev/null | wc -l)

echo "$SCHEMA_C_FILES" | while read FILE; do
    if [ -z "$FILE" ]; then
        continue
    fi

    # Count hazards in this file
    HAZARD_COUNT=$(grep "// hazard:" "$FILE" 2>/dev/null | wc -l)

    # Count edges in this file
    EDGES=$(grep "// edge:" "$FILE" 2>/dev/null)
    EDGE_COUNT=$(echo "$EDGES" | grep -c "// edge:" 2>/dev/null || echo 0)

    # Check for why statement
    HAS_WHY=$(grep -c "// why:" "$FILE" 2>/dev/null || echo 0)

    # Validate hazards (minimum 2)
    if [ "$HAZARD_COUNT" -lt 2 ]; then
        echo "❌ $FILE: Missing hazards (found $HAZARD_COUNT, need >= 2)" >> "$ISSUES_FILE"
        HAZARD_ERRORS=$((HAZARD_ERRORS + 1))
    fi

    # Validate why statement
    if [ "$HAS_WHY" -eq 0 ]; then
        echo "❌ $FILE: Missing 'why:' statement" >> "$ISSUES_FILE"
        WHY_ERRORS=$((WHY_ERRORS + 1))
    fi

    # Validate edges
    if [ -n "$EDGES" ]; then
        echo "$EDGES" | while read EDGE; do
            [ -z "$EDGE" ] && continue

            # Extract edge type
            EDGE_TYPE=$(echo "$EDGE" | sed -E 's/.*-> ([A-Z_]+).*/\1/')

            # Validate edge type
            if ! echo "RELATES CALLS READS WRITES SERVES STEP_IN" | grep -q "$EDGE_TYPE"; then
                echo "⚠️  $FILE: Invalid edge type '$EDGE_TYPE'" >> "$ISSUES_FILE"
                EDGE_ERRORS=$((EDGE_ERRORS + 1))
            fi

            # Extract target path
            TARGET=$(echo "$EDGE" | sed -E 's/.*edge:([^ ]+).*/\1/')

            # Check if target exists (skip directory refs and section refs)
            if ! echo "$TARGET" | grep -q '/$' && ! echo "$TARGET" | grep -q '#'; then
                if [ ! -f "$REPO_ROOT/$TARGET" ]; then
                    echo "❌ $FILE: Edge target not found: $TARGET" >> "$ISSUES_FILE"
                    EDGE_TARGET_ERRORS=$((EDGE_TARGET_ERRORS + 1))
                fi
            fi
        done
    fi
done

# Print summary
{
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "VALIDATION RESULTS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Total files with breadcrumbs: $TOTAL_FILES"
    echo "Total hazards found: $TOTAL_HAZARDS"
    echo "Total edges found: $TOTAL_EDGES"
    echo ""
    if [ "$TOTAL_FILES" -gt 0 ]; then
        AVG_HAZARDS=$((TOTAL_HAZARDS / TOTAL_FILES))
        AVG_EDGES=$((TOTAL_EDGES / TOTAL_FILES))
        echo "Average hazards per file: $AVG_HAZARDS"
        echo "Average edges per file: $AVG_EDGES"
    fi
    echo ""
    echo "ERRORS FOUND:"
    echo "  • Hazard violations (< 2): $HAZARD_ERRORS files"
    echo "  • Missing 'why:' statement: $WHY_ERRORS files"
    echo "  • Invalid edge types: $EDGE_ERRORS edges"
    echo "  • Missing edge targets: $EDGE_TARGET_ERRORS edges"
    echo ""

    TOTAL_ERRORS=$((HAZARD_ERRORS + WHY_ERRORS + EDGE_ERRORS + EDGE_TARGET_ERRORS))
    if [ $TOTAL_ERRORS -eq 0 ]; then
        echo "✅ All breadcrumbs validated successfully!"
    else
        echo "⚠️  Total issues: $TOTAL_ERRORS (see breadcrumb-issues.txt)"
    fi
} | tee -a "$SUMMARY_FILE"

echo ""
echo "Results saved to:"
echo "  • $SUMMARY_FILE"
echo "  • $ISSUES_FILE"
