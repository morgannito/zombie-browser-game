#!/bin/sh
# Trigger a V8 heap snapshot via SIGUSR2
# The server must have --inspect or use v8.writeHeapSnapshot() on SIGUSR2
# Usage: ./scripts/heap-snapshot.sh <pid>

set -e

PID="${1:-}"

if [ -z "$PID" ]; then
    PID=$(pgrep -f "node.*deploy-server" | head -1)
fi

if [ -z "$PID" ]; then
    echo "ERROR: no PID provided and no running node server found" >&2
    echo "Usage: $0 <pid>" >&2
    exit 1
fi

echo "Sending SIGUSR2 to PID $PID for heap snapshot..."
kill -USR2 "$PID"

echo "Heap snapshot triggered. Check server logs or project root for Heap-*.heapsnapshot"
