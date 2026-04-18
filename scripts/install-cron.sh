#!/bin/sh
# install-cron.sh — Installe l'entree cron zombie-backup (toutes les 6h)
# Idempotent : ne duplique pas si l'entree est deja presente

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
CRON_MARKER="zombie-backup"
CRON_ENTRY="0 */6 * * * $BACKUP_SCRIPT >> /var/log/zombie-backup.log 2>&1 # $CRON_MARKER"

if crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
    echo "Entree cron deja presente, rien a faire."
    exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
echo "Entree cron installee : $CRON_ENTRY"
