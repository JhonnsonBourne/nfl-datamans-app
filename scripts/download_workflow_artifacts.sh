#!/bin/bash
# Download performance test artifacts from GitHub Actions
# Usage: ./scripts/download_workflow_artifacts.sh [run_id]

set -e

REPO="JhonnsonBourne/nfl-datamans-app"
RUN_ID="${1:-latest}"

echo "📥 Downloading artifacts from workflow run: $RUN_ID"
echo "Repository: $REPO"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not installed"
    echo "Install with: brew install gh"
    echo "Or download manually from: https://github.com/$REPO/actions"
    exit 1
fi

# Authenticate if needed
gh auth status || gh auth login

# Create artifacts directory
ARTIFACTS_DIR="workflow-artifacts-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ARTIFACTS_DIR"

echo "📦 Downloading artifacts..."
gh run download "$RUN_ID" --repo "$REPO" --dir "$ARTIFACTS_DIR" || {
    echo "⚠️  Failed to download. Trying with latest run..."
    gh run download --repo "$REPO" --dir "$ARTIFACTS_DIR" || {
        echo "❌ Could not download artifacts"
        echo "Please download manually from: https://github.com/$REPO/actions"
        exit 1
    }
}

echo ""
echo "✅ Artifacts downloaded to: $ARTIFACTS_DIR"
echo ""
echo "📊 Analyzing performance data..."
python3 scripts/analyze_workflow_performance.py "$ARTIFACTS_DIR"

echo ""
echo "📄 View report:"
echo "cat $ARTIFACTS_DIR/performance_report.md"

