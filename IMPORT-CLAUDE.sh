#!/usr/bin/env bash
# IMPORT-CLAUDE.sh — Copy the Claude Code environment into the current project
#
# Usage:
#   bash IMPORT-CLAUDE.sh
#   (run from inside the project you want to set up)
#
# What it copies:
#   CLAUDE.md          — project-level instructions (skipped if already exists)
#   .claude/agents/    — custom subagent definitions
#   .mcp.json          — MCP server configuration (skipped if already exists)
#
# What it installs:
#   ponytail plugin    — via `claude plugin` CLI
#
# What it does NOT copy:
#   .claude/settings.local.json  — machine-local settings (permissions, etc.)
#   .claude/projects/            — session memory (project-specific)

set -euo pipefail

SOURCE_DIR="/Volumes/STORAGE/SITES-2025/Claude_Template"
TARGET_DIR="$(pwd)"

# ── Validate ────────────────────────────────────────────────────────────────
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: source directory does not exist: $SOURCE_DIR"
  exit 1
fi

echo "Copying Claude environment from:"
echo "  $SOURCE_DIR"
echo "to:"
echo "  $TARGET_DIR"
echo ""

# ── CLAUDE.md ───────────────────────────────────────────────────────────────
if [[ -f "$TARGET_DIR/CLAUDE.md" ]]; then
  echo "⏭️   CLAUDE.md already exists — skipped (edit manually)"
elif [[ -f "$SOURCE_DIR/CLAUDE.md" ]]; then
  cp "$SOURCE_DIR/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"
  echo "✅  CLAUDE.md"
else
  echo "⚠️   CLAUDE.md not found in source — skipped"
fi

# ── .claude/agents/ ─────────────────────────────────────────────────────────
if [[ -d "$SOURCE_DIR/.claude/agents" ]]; then
  mkdir -p "$TARGET_DIR/.claude/agents"
  cp -Rf "$SOURCE_DIR/.claude/agents/." "$TARGET_DIR/.claude/agents/"
  echo "✅  .claude/agents/ ($(ls "$SOURCE_DIR/.claude/agents/" | wc -l | tr -d ' ') agents)"
else
  echo "⚠️   .claude/agents/ not found — skipped"
fi

# ── .mcp.json ───────────────────────────────────────────────────────────────
if [[ -f "$SOURCE_DIR/.mcp.json" ]]; then
  if [[ -f "$TARGET_DIR/.mcp.json" ]]; then
    echo "⚠️   .mcp.json already exists in target — skipping (edit manually to merge)"
  else
    cp -f "$SOURCE_DIR/.mcp.json" "$TARGET_DIR/.mcp.json"
    echo "✅  .mcp.json"
  fi
else
  echo "⚠️   .mcp.json not found — skipped"
fi

# ── ponytail plugin ─────────────────────────────────────────────────────────
if command -v claude &>/dev/null; then
  claude plugin marketplace add DietrichGebert/ponytail &>/dev/null
  if claude plugin install ponytail@ponytail 2>/dev/null; then
    echo "✅  ponytail plugin"
  else
    echo "ℹ️   ponytail already installed"
  fi
else
  echo "⚠️   claude CLI not found — install ponytail manually:"
  echo "      claude plugin marketplace add DietrichGebert/ponytail"
  echo "      claude plugin install ponytail@ponytail"
fi

echo ""
echo "Done. Update CLAUDE.md for this project's stack, then open it in Claude Code."