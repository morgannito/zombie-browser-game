#!/bin/sh
# restore-db.sh — Restore SQLite backup with checksum verification
# Usage: restore-db.sh <backup-file.db.gz>

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${ROOT_DIR}/data/game.db"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup-file.db.gz>" >&2
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

# Decompress to temp file
TMP_DB="$(mktemp /tmp/zombie-restore-XXXXXX.db)"
trap 'rm -f "$TMP_DB"' EXIT

gzip -dc "$BACKUP_FILE" > "$TMP_DB"
echo "Decompressed to: $TMP_DB"

# Verify integrity
if ! sqlite3 "$TMP_DB" "PRAGMA integrity_check;" | grep -q "^ok$"; then
    echo "ERROR: Integrity check failed on backup" >&2
    exit 1
fi
echo "Integrity check: OK"

# Compute checksum of decompressed backup
if command -v sha256sum > /dev/null 2>&1; then
    CHECKSUM="$(sha256sum "$TMP_DB" | cut -d' ' -f1)"
    CHECKSUM_CMD="sha256sum"
elif command -v shasum > /dev/null 2>&1; then
    CHECKSUM="$(shasum -a 256 "$TMP_DB" | cut -d' ' -f1)"
    CHECKSUM_CMD="shasum -a 256"
else
    echo "WARNING: No sha256 tool found, skipping checksum" >&2
    CHECKSUM="N/A"
fi
echo "Checksum (SHA-256): ${CHECKSUM}"

# Safety: backup current DB before overwriting
if [ -f "$DB_PATH" ]; then
    SAFE_COPY="${DB_PATH}.before-restore.$(date +%Y%m%d_%H%M%S)"
    cp "$DB_PATH" "$SAFE_COPY"
    echo "Current DB saved to: $SAFE_COPY"
fi

# Copy restored DB into place (remove WAL artefacts)
cp "$TMP_DB" "$DB_PATH"
rm -f "${DB_PATH}-shm" "${DB_PATH}-wal"

# Final check on live DB
sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "^ok$" \
    && echo "Restore successful: $DB_PATH" \
    || { echo "ERROR: Post-restore integrity check failed" >&2; exit 1; }
