#!/usr/bin/env python3
"""
Agent Sync Helper Script

This script helps AI agents maintain continuity by automatically updating
WORK_IN_PROGRESS.md and tracking changes.

Usage:
    python agent_sync.py --update "Working on feature X"
    python agent_sync.py --status
    python agent_sync.py --files
    python agent_sync.py --session-start "Claude Sonnet 4.5"
    python agent_sync.py --session-end "Completed feature X"
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

WORK_IN_PROGRESS_FILE = Path(__file__).parent / "WORK_IN_PROGRESS.md"
AGENT_INSTRUCTIONS_FILE = Path(__file__).parent / "AGENT_INSTRUCTIONS.md"


def get_recent_files(hours: int = 24) -> List[Path]:
    """Get files modified in the last N hours."""
    cutoff = datetime.now().timestamp() - (hours * 3600)
    recent = []
    
    # Exclude certain directories
    exclude_dirs = {'.git', '__pycache__', 'node_modules', '.venv', 'venv', 'env'}
    
    for root, dirs, files in os.walk(Path(__file__).parent):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            file_path = Path(root) / file
            if file_path.stat().st_mtime > cutoff:
                recent.append(file_path)
    
    return sorted(recent, key=lambda p: p.stat().st_mtime, reverse=True)


def read_work_in_progress() -> str:
    """Read current WORK_IN_PROGRESS.md content."""
    if WORK_IN_PROGRESS_FILE.exists():
        return WORK_IN_PROGRESS_FILE.read_text(encoding='utf-8')
    return ""


def append_to_work_in_progress(content: str):
    """Append content to WORK_IN_PROGRESS.md."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if WORK_IN_PROGRESS_FILE.exists():
        existing = WORK_IN_PROGRESS_FILE.read_text(encoding='utf-8')
        # Add separator if file has content
        if existing.strip():
            content = f"\n\n---\n\n## Agent Update - {timestamp}\n\n{content}\n"
            final_content = existing + content
        else:
            content = f"# Work In Progress\n\n## Agent Update - {timestamp}\n\n{content}\n"
            final_content = content
    else:
        content = f"# Work In Progress\n\n## Agent Update - {timestamp}\n\n{content}\n"
        final_content = content
    
    WORK_IN_PROGRESS_FILE.write_text(final_content, encoding='utf-8')
    print(f"✅ Updated {WORK_IN_PROGRESS_FILE}")


def format_file_list(files: List[Path]) -> str:
    """Format file list for markdown."""
    base_path = Path(__file__).parent
    formatted = []
    for file in files[:20]:  # Limit to 20 most recent
        rel_path = file.relative_to(base_path)
        mod_time = datetime.fromtimestamp(file.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        formatted.append(f"- `{rel_path}` - Modified: {mod_time}")
    
    if len(files) > 20:
        formatted.append(f"- ... and {len(files) - 20} more files")
    
    return "\n".join(formatted)


def cmd_status():
    """Show current status."""
    print("📊 Current Project Status\n")
    
    if WORK_IN_PROGRESS_FILE.exists():
        content = read_work_in_progress()
        # Extract last few updates
        lines = content.split('\n')
        print("Last updates from WORK_IN_PROGRESS.md:")
        print("-" * 60)
        # Show last 30 lines
        print('\n'.join(lines[-30:]))
    else:
        print("⚠️  WORK_IN_PROGRESS.md not found. Creating it...")
        WORK_IN_PROGRESS_FILE.write_text("# Work In Progress\n\n", encoding='utf-8')
    
    print("\n" + "-" * 60)
    print("\n📁 Recently Modified Files (last 24 hours):")
    recent = get_recent_files(24)
    if recent:
        for file in recent[:10]:
            rel_path = file.relative_to(Path(__file__).parent)
            mod_time = datetime.fromtimestamp(file.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  • {rel_path} ({mod_time})")
    else:
        print("  No files modified in last 24 hours")


def cmd_files():
    """List recently modified files."""
    print("📁 Recently Modified Files\n")
    
    recent = get_recent_files(24)
    if not recent:
        print("No files modified in last 24 hours.")
        return
    
    print(f"Found {len(recent)} files modified in last 24 hours:\n")
    base_path = Path(__file__).parent
    
    for file in recent:
        rel_path = file.relative_to(base_path)
        mod_time = datetime.fromtimestamp(file.stat().st_mtime)
        size = file.stat().st_size
        print(f"  {rel_path}")
        print(f"    Modified: {mod_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"    Size: {size:,} bytes")
        print()


def cmd_session_start(agent_name: str):
    """Mark session start."""
    content = f"""### Agent Session Started
**Agent**: {agent_name}
**Time**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

**Status**: Starting work

"""
    append_to_work_in_progress(content)
    print(f"✅ Session started for {agent_name}")


def cmd_session_end(agent_name: str, summary: Optional[str] = None):
    """Mark session end with summary."""
    recent = get_recent_files(6)  # Files modified in last 6 hours
    base_path = Path(__file__).parent
    
    file_list = []
    for file in recent[:15]:
        rel_path = file.relative_to(base_path)
        file_list.append(f"- `{rel_path}`")
    
    content = f"""### Agent Session Ended
**Agent**: {agent_name}
**Time**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

**Status**: Session completed

"""
    
    if summary:
        content += f"**Summary**: {summary}\n\n"
    
    if file_list:
        content += "**Files Modified**:\n" + "\n".join(file_list) + "\n\n"
    
    content += "**Next Agent**: Please read this update and continue from here.\n"
    
    append_to_work_in_progress(content)
    print(f"✅ Session ended for {agent_name}")
    if summary:
        print(f"   Summary: {summary}")


def cmd_update(message: str):
    """Quick update to work in progress."""
    recent = get_recent_files(6)
    base_path = Path(__file__).parent
    
    file_list = []
    for file in recent[:10]:
        rel_path = file.relative_to(base_path)
        file_list.append(f"- `{rel_path}`")
    
    content = f"""**Update**: {message}

"""
    
    if file_list:
        content += "**Recent Files**:\n" + "\n".join(file_list) + "\n"
    
    append_to_work_in_progress(content)
    print(f"✅ Updated: {message}")


def cmd_create_template():
    """Create a template entry."""
    template = """### Current Task
[Describe what you're working on]

### Files Modified:
- [ ] `api.py` - [What changed]
- [ ] `frontend/src/...` - [What changed]

### Completed:
- [ ] [Task 1]
- [ ] [Task 2]

### In Progress:
- [ ] [Task 3]

### Next Steps:
1. [ ] [Next task 1]
2. [ ] [Next task 2]

### Blockers:
- [Describe any blockers]

### Notes:
[Any important context]
"""
    
    append_to_work_in_progress(template)
    print("✅ Created template entry in WORK_IN_PROGRESS.md")


def main():
    parser = argparse.ArgumentParser(
        description="Agent Sync Helper - Maintain continuity between AI agent sessions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python agent_sync.py --session-start "Claude Sonnet 4.5"
  python agent_sync.py --update "Fixed bug in route calculation"
  python agent_sync.py --session-end "Claude Sonnet 4.5" --summary "Completed feature X"
  python agent_sync.py --status
  python agent_sync.py --files
        """
    )
    
    parser.add_argument(
        '--update',
        metavar='MESSAGE',
        help='Quick update with a message'
    )
    
    parser.add_argument(
        '--session-start',
        metavar='AGENT_NAME',
        help='Mark session start (e.g., "Claude Sonnet 4.5")'
    )
    
    parser.add_argument(
        '--session-end',
        metavar='AGENT_NAME',
        help='Mark session end'
    )
    
    parser.add_argument(
        '--summary',
        metavar='TEXT',
        help='Summary for session end'
    )
    
    parser.add_argument(
        '--status',
        action='store_true',
        help='Show current status'
    )
    
    parser.add_argument(
        '--files',
        action='store_true',
        help='List recently modified files'
    )
    
    parser.add_argument(
        '--template',
        action='store_true',
        help='Create a template entry'
    )
    
    args = parser.parse_args()
    
    # Ensure WORK_IN_PROGRESS.md exists
    if not WORK_IN_PROGRESS_FILE.exists():
        WORK_IN_PROGRESS_FILE.write_text("# Work In Progress\n\n", encoding='utf-8')
    
    # Execute command
    if args.update:
        cmd_update(args.update)
    elif args.session_start:
        cmd_session_start(args.session_start)
    elif args.session_end:
        cmd_session_end(args.session_end, args.summary)
    elif args.status:
        cmd_status()
    elif args.files:
        cmd_files()
    elif args.template:
        cmd_create_template()
    else:
        parser.print_help()
        print("\n💡 Tip: Start with 'python agent_sync.py --status' to see current state")


if __name__ == "__main__":
    main()

