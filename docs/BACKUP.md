# Backup & Restore — Zombie Browser Game

## Scripts disponibles

| Script | Rôle |
|--------|------|
| `scripts/backup-db.sh` | Backup shell (WAL checkpoint + gzip, rotation 14) |
| `scripts/backup.js` | Backup Node.js via DatabaseManager (rotation configurable, défaut 7) |
| `scripts/restore-db.sh` | Restauration avec vérification intégrité SHA-256 |

## Rétention

- **backup-db.sh** : 14 backups (`.db.gz`) dans `backups/`
- **backup.js** : 7 backups par défaut (surcharger via `--keep N`) dans `data/backups/`

## Backup

```sh
# Shell (recommandé en cron)
./scripts/backup-db.sh

# Node (via npm ou manuellement)
node scripts/backup.js [--dest <dir>] [--keep <N>]
```

Cron suggéré (quotidien à 3h) :
```
0 3 * * * /path/to/scripts/backup-db.sh >> /var/log/zombie-backup.log 2>&1
```

## Restauration

```sh
./scripts/restore-db.sh backups/zombie-YYYY-MM-DD_HHMM.db.gz
```

Le script :
1. Décompresse dans un fichier temporaire
2. Vérifie `PRAGMA integrity_check`
3. Calcule le SHA-256
4. Sauvegarde la DB courante en `.before-restore.<timestamp>`
5. Copie la DB restaurée, supprime les artefacts WAL (`.shm`, `.wal`)
6. Vérifie l'intégrité de la DB en place

## Emplacements

```
data/game.db          # Base de production
data/backups/         # Backups Node.js (game_*.db)
backups/              # Backups shell (zombie-*.db.gz)
```
