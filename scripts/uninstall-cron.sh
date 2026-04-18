#!/bin/sh
# uninstall-cron.sh — Retire l'entree cron zombie-backup

set -eu

CRON_MARKER="zombie-backup"

if ! crontab -l 2>/dev/null | grep -q "$CRON_MARKER"; then
    echo "Aucune entree cron zombie-backup trouvee, rien a faire."
    exit 0
fi

crontab -l 2>/dev/null | grep -v "$CRON_MARKER" | crontab -
echo "Entree cron zombie-backup retiree."
