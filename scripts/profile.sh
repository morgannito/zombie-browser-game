#!/bin/sh
# V8 CPU profiling via --prof flag
# Usage: ./scripts/profile.sh [seconds] [entry_point]
# Default: 30s, deploy-server.js

set -e

DURATION="${1:-30}"
ENTRY="${2:-deploy-server.js}"
OUTDIR="$(pwd)"

echo "Starting server with --prof (entry: $ENTRY, duration: ${DURATION}s)..."

node --prof "$ENTRY" &
SERVER_PID=$!

echo "Server PID: $SERVER_PID — waiting ${DURATION}s..."
sleep "$DURATION"

echo "Sending SIGUSR2 to trigger V8 dump..."
kill -USR2 "$SERVER_PID" 2>/dev/null || true
sleep 2

echo "Stopping server..."
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

ISOLATE_LOG=$(ls "$OUTDIR"/isolate-*.log 2>/dev/null | head -1)
if [ -z "$ISOLATE_LOG" ]; then
    echo "ERROR: no isolate-*.log file found in $OUTDIR" >&2
    exit 1
fi

echo "Processing $ISOLATE_LOG -> profile.txt..."
node --prof-process "$ISOLATE_LOG" > "$OUTDIR/profile.txt"
echo "Done. Results in profile.txt"
