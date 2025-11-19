#!/usr/bin/env python3
"""
Script pour automatiser la correction des memory leaks
Remplace addEventListener, setTimeout, setInterval par leurs versions managées
"""

import re
import os
from pathlib import Path

PUBLIC_DIR = Path(__file__).parent / "public"

# Fichiers à exclure (ceux qui sont les managers eux-mêmes)
EXCLUDE_FILES = {
    "EventListenerManager.js",
    "TimerManager.js",
}

def fix_event_listeners(content, filename):
    """
    Remplace addEventListener par eventListenerManager.add
    Pattern: element.addEventListener('event', handler, options)
    Devient: window.eventListenerManager ?
        window.eventListenerManager.add(element, 'event', handler, options) :
        element.addEventListener('event', handler, options)
    """
    # Pattern pour capturer addEventListener
    pattern = r'(\w+)\.addEventListener\(([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)'

    def replacer(match):
        element = match.group(1)
        event = match.group(2)
        handler = match.group(3)
        options = match.group(4) if match.group(4) else ''

        if options:
            return (
                f"(window.eventListenerManager ? "
                f"window.eventListenerManager.add({element}, {event}, {handler}, {options}) : "
                f"{element}.addEventListener({event}, {handler}, {options}))"
            )
        else:
            return (
                f"(window.eventListenerManager ? "
                f"window.eventListenerManager.add({element}, {event}, {handler}) : "
                f"{element}.addEventListener({event}, {handler}))"
            )

    # Ne pas remplacer dans les commentaires
    lines = content.split('\n')
    result_lines = []

    for line in lines:
        # Skip comments
        if line.strip().startswith('//') or line.strip().startswith('*'):
            result_lines.append(line)
            continue

        # Replace addEventListener in code
        new_line = re.sub(pattern, replacer, line)
        result_lines.append(new_line)

    return '\n'.join(result_lines)

def fix_timeouts(content, filename):
    """
    Remplace setTimeout par timerManager.setTimeout
    Pattern: setTimeout(callback, delay, ...args)
    Devient: window.timerManager ? window.timerManager.setTimeout(callback, delay, ...args) : setTimeout(callback, delay, ...args)
    """
    # Pattern simple pour setTimeout
    pattern = r'\bsetTimeout\('

    def replacer(match):
        return "(window.timerManager ? window.timerManager.setTimeout : setTimeout)("

    # Ne pas remplacer dans les commentaires et dans TimerManager.js lui-même
    lines = content.split('\n')
    result_lines = []

    for line in lines:
        # Skip comments
        if line.strip().startswith('//') or line.strip().startswith('*'):
            result_lines.append(line)
            continue

        # Skip if already using timerManager
        if 'timerManager.setTimeout' in line or 'window.setTimeout' in line:
            result_lines.append(line)
            continue

        # Replace setTimeout in code
        new_line = re.sub(pattern, replacer, line)
        result_lines.append(new_line)

    return '\n'.join(result_lines)

def fix_intervals(content, filename):
    """
    Remplace setInterval par timerManager.setInterval
    """
    pattern = r'\bsetInterval\('

    def replacer(match):
        return "(window.timerManager ? window.timerManager.setInterval : setInterval)("

    lines = content.split('\n')
    result_lines = []

    for line in lines:
        # Skip comments
        if line.strip().startswith('//') or line.strip().startswith('*'):
            result_lines.append(line)
            continue

        # Skip if already using timerManager
        if 'timerManager.setInterval' in line or 'window.setInterval' in line:
            result_lines.append(line)
            continue

        # Replace setInterval in code
        new_line = re.sub(pattern, replacer, line)
        result_lines.append(new_line)

    return '\n'.join(result_lines)

def process_file(filepath):
    """Process a single JS file"""
    filename = filepath.name

    if filename in EXCLUDE_FILES:
        print(f"⏭️  Skipping {filename} (excluded)")
        return False

    print(f"🔧 Processing {filename}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Apply fixes
    content = fix_event_listeners(content, filename)
    content = fix_timeouts(content, filename)
    content = fix_intervals(content, filename)

    # Only write if changes were made
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Fixed {filename}")
        return True
    else:
        print(f"⏭️  No changes needed for {filename}")
        return False

def main():
    print("🚀 Starting memory leak fixes...")
    print(f"📁 Processing files in: {PUBLIC_DIR}")
    print()

    # Find all JS files in public directory
    js_files = list(PUBLIC_DIR.glob("*.js"))
    js_files.extend(PUBLIC_DIR.glob("**/*.js"))

    fixed_count = 0
    total_count = 0

    for filepath in js_files:
        total_count += 1
        if process_file(filepath):
            fixed_count += 1

    print()
    print(f"📊 Summary:")
    print(f"   Total files: {total_count}")
    print(f"   Files modified: {fixed_count}")
    print(f"   Files skipped: {total_count - fixed_count}")
    print()
    print("✨ Done! Memory leak fixes applied.")

if __name__ == "__main__":
    main()
