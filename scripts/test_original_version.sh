#!/bin/bash
# Script to test the original version of the codebase
# This checks out the earliest commit and tests if the performance issue exists

set -e

REPO_DIR="/Users/ethan/Coding/nfl-datamans-app"
ORIGINAL_BRANCH=$(git branch --show-current)
EARLIEST_COMMIT=$(git rev-list --max-parents=0 HEAD)

echo "🔍 Finding earliest commit..."
echo "Earliest commit: $EARLIEST_COMMIT"
git log --oneline -1 $EARLIEST_COMMIT

echo ""
echo "📋 Current branch: $ORIGINAL_BRANCH"
echo "📋 Will checkout: $EARLIEST_COMMIT"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Save current state
echo "💾 Saving current state..."
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Current commit: $CURRENT_COMMIT"

# Create a backup branch
BACKUP_BRANCH="backup-before-test-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH" 2>/dev/null || echo "Backup branch exists or not needed"

# Checkout earliest commit
echo ""
echo "⏮️  Checking out earliest commit..."
git checkout "$EARLIEST_COMMIT"

# Check if frontend exists
if [ ! -d "frontend" ]; then
    echo "⚠️  Frontend directory not found in earliest commit"
    echo "This might be a very early version without frontend"
    git checkout "$ORIGINAL_BRANCH"
    exit 1
fi

# Check if PlayerStats exists
if [ ! -f "frontend/src/pages/PlayerStats.jsx" ]; then
    echo "⚠️  PlayerStats.jsx not found in earliest commit"
    echo "Checking what files exist..."
    find frontend/src -name "*.jsx" -o -name "*.js" | head -10
    git checkout "$ORIGINAL_BRANCH"
    exit 1
fi

echo ""
echo "✅ Checked out earliest commit"
echo ""
echo "📊 Checking PlayerStats.jsx for data fetching..."
grep -n "getPlayerStats\|10000\|limit" frontend/src/pages/PlayerStats.jsx | head -5 || echo "Pattern not found"

echo ""
echo "🔧 To test this version:"
echo "1. cd frontend && npm install"
echo "2. npm run dev"
echo "3. Test filtering by position"
echo ""
echo "⏪ To return to current version:"
echo "git checkout $ORIGINAL_BRANCH"

