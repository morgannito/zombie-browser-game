#!/bin/sh
# backup-db.sh — SQLite consistent backup with WAL checkpoint + gzip + 14-backup rotation

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${ROOT_DIR}/data/game.db"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H%M)"
BACKUP_NAME="zombie-${TIMESTAMP}.db"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "$BACKUP_DIR"

if ! command -v sqlite3 > /dev/null 2>&1; then
    echo "ERROR: sqlite3 CLI not found" >&2
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: Database not found: $DB_PATH" >&2
    exit 1
fi

# Consistent backup via SQLite .backup (handles WAL automatically)
sqlite3 "$DB_PATH" ".backup '${BACKUP_PATH}'"
echo "Backup created: ${BACKUP_PATH}"

# Compress
gzip "$BACKUP_PATH"
echo "Compressed: ${BACKUP_PATH}.gz"

# Keep only 14 most recent backups
ls -t "${BACKUP_DIR}"/zombie-*.db.gz 2>/dev/null | tail -n +15 | while read -r old; do
    rm "$old"
    echo "Removed old backup: $old"
done

echo "Done. Backups kept: $(ls "${BACKUP_DIR}"/zombie-*.db.gz 2>/dev/null | wc -l | tr -d ' ')/14"
