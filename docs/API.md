# API HTTP — Zombie Browser Game

Base URL : `https://<host>/api/v1`  
Authentification : header `Authorization: Bearer <token>` (JWT)

---

## Format des réponses

**Succès**
```json
{ "success": true, "data": { ... } }
```

**Erreur**
```json
{
  "success": false,
  "error": "CODE_ERREUR",
  "message": "Description lisible en français."
}
```

---

## Endpoints

### POST /auth/login

Crée une nouvelle identité anonyme. Chaque appel génère un UUID unique — le pseudo est uniquement cosmétique.

**Corps**
```json
{ "username": "MonPseudo" }
```

Contraintes : 2–15 caractères, lettres/chiffres/espaces/tirets/underscores.

**Réponse 200**
```json
{
  "token": "eyJ...",
  "player": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "MonPseudo",
    "highScore": 0,
    "totalKills": 0,
    "gamesPlayed": 0
  }
}
```

**Erreurs**
| Code | HTTP | Message |
|------|------|---------|
| `USERNAME_INVALID` | 400 | Le pseudo doit contenir entre 2 et 15 caractères. |
| `USERNAME_CHARS_INVALID` | 400 | Le pseudo ne peut contenir que des lettres, chiffres, espaces, tirets et underscores. |
| `LOGIN_FAILED` | 500 | Impossible de créer la session. Réessaie dans un moment. |

```bash
curl -X POST https://<host>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"MonPseudo"}'
```

---

### GET /leaderboard?limit=10

Retourne le classement global. `limit` : 1–100, défaut 10. Authentification requise.

**Réponse 200**
```json
{
  "entries": [
    { "rank": 1, "playerId": "550e...", "username": "ProGamer", "highScore": 4200, "totalKills": 987 }
  ],
  "total": 1
}
```

```bash
curl https://<host>/api/v1/leaderboard?limit=10 \
  -H "Authorization: Bearer <token>"
```

---

### GET /players/:id/stats

Retourne les statistiques d'un joueur. Authentification requise — accès limité à son propre compte.

**Réponse 200**
```json
{
  "player": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "MonPseudo",
    "highScore": 1500,
    "gamesPlayed": 42
  },
  "stats": {
    "totalKills": 350,
    "totalXP": 12000,
    "averageScore": 600
  }
}
```

**Erreurs**
| Code | HTTP | Message |
|------|------|---------|
| `NOT_FOUND` | 404 | Player not found |

```bash
curl https://<host>/api/v1/players/550e8400-e29b-41d4-a716-446655440000/stats \
  -H "Authorization: Bearer <token>"
```

---

### POST /progression/add-xp

Ajoute de l'XP après une partie. Authentification requise — accès limité à son propre compte.

**Paramètre d'URL** : `:playerId` (UUID du joueur)  
Route complète : `POST /api/v1/progression/:playerId/add-xp`

**Corps**
```json
{ "xp": 250 }
```

Contraintes : entier, 0–100 000 000.

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "xpAdded": 250,
    "levelUp": false,
    "progression": {
      "level": 5,
      "totalXP": 12250,
      "xpToNextLevel": 750
    }
  }
}
```

**Erreurs**
| Code | HTTP | Message |
|------|------|---------|
| `XP_ADD_FAILED` | 500 | Impossible d'enregistrer l'XP. Ta progression sera mise à jour à la prochaine partie. |

```bash
curl -X POST https://<host>/api/v1/progression/550e8400-e29b-41d4-a716-446655440000/add-xp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"xp":250}'
```
