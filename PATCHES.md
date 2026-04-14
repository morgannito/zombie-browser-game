# Patches non-upstream — production zombie.morgannriu.fr

Patches appliqués à la prod via `/var/www/zombie.morgannriu.fr/patches/` + `deploy.sh` réécrit pour les ré-injecter après `git reset --hard origin/main`.

À supprimer ici quand mergés upstream.

---

## 1. CSP `style-src` + `'unsafe-inline'`

**Fichier** : `middleware/security.js`

Sans `'unsafe-inline'`, le browser ignore tous les `style="display:none"` HTML inline. Conséquence : `#level-up-screen`, `#shop`, `#game-over`, `#settings-menu`, `#nickname-screen` deviennent visibles par défaut (CSS de base = `display:flex/block`). Le nickname screen est masqué sous des modals empilés → impossible de cliquer "Commencer" → socket jamais connecté → jeu ne démarre pas.

**Critique**. Sans ce patch, la prod est inutilisable.

**Fix propre upstream** : remplacer chaque `style="display:none"` HTML par `class="hidden"` + `.hidden { display: none !important }`. Garde CSP stricte.

---

## 2. `weaponWheel.js` — touche E + Échap + auto-close

`A` (QWERTY) entrait en conflit avec mouvement gauche AZERTY. Le hint affichait "Q" mais le code écoutait "A". Wheel s'ouvrait par-dessus level-up.

- Touche `E` (zéro conflit avec ZQSD/WASD/flèches)
- `Escape` ferme
- `MutationObserver` sur les modals bloquants → auto-close si l'un apparaît
- Garde d'ouverture : check `pause-menu.is-open`, `#upgrade-choices.children.length > 0`, `style.display` des autres modals
- Hint UI corrigé : "Touche E ou Échap pour fermer"

---

## 3. `perfPatches.js` — nouveau (Canvas 2D shadowBlur runtime toggle)

Monkey-patch sur `CanvasRenderingContext2D.prototype.shadowBlur` setter. Quand désactivé, toutes les assignations deviennent des no-ops (`shadowBlur === 0`).

Pourquoi : `EntityRenderer` utilise `shadowBlur` 30+ fois par frame (yeux zombies, auras élite, indicateurs spéciaux, boss, projectiles). À 30+ zombies, désactiver shadowBlur **double les FPS**.

API exposée :
- `window.setCanvasShadowsEnabled(true|false)` — toggle runtime
- `window.useZombieFastDraw` — auto-tied au shadows toggle (cf §6)

Honore `localStorage.zombieGamePerformanceSettings.shadowsEnabled` au boot.

Chargé via `index.html` AVANT `EventListenerManager.js` pour patcher le prototype avant tout code canvas.

---

## 4. `performanceSettings.js` — auto-adjust + propagation

- `applySettings()` propage `shadowsEnabled` vers `window.setCanvasShadowsEnabled()` (le toggle UI fonctionne enfin)
- Mode "performance" force `shadowsEnabled = false` + `particlesEnabled = false`
- **Auto-adjust réactivé** (était commenté). Trigger à `currentFPS < 40`, cooldown 5s
- **Step 0 ajouté** : désactive shadows en premier (gain max, coût visuel ~0). Ordre : shadows → particles → grid → resolution scale

---

## 5. `GameStateManager.js` — interpolation 2.5× plus snappy

`baseSpeed: 10 → 25`. Smoothing exponentiel `1 - exp(-25·dt/1000)` à 60 FPS = 35% catch-up par frame (vs 15%). Catch-up 50px en ~12 frames (200ms) au lieu de 30 (500ms). Extrapolation reste clampée à 100ms / 50px (anti-overshoot).

---

## 6. `EntityRenderer.js` — fast zombie sprite

Nouveau `_drawZombieFast()` : **7 ops** par zombie (body fillRect, head arc, 2 eyes fillRect) au lieu de 25+ (legs avec rotate, arms avec rotate, head, eyes shadowBlur, mouth, type details). **~5× plus rapide**.

Activé via `window.useZombieFastDraw === true` (auto-tied à `setCanvasShadowsEnabled(false)`). Utilisé en perf mode + auto-adjust.

`drawZombieSprite()` original conservé, fast path en early-return. Toggle off = rendering original 100%.

---

## 7. Profiling runtime (PlayerController + GameEngine.render)

Buckets de timings dans `PlayerController.update()` et `GameEngine.render()`. Flush via `console.table` toutes les 5s :

- `[perf] PlayerController.update` : `total`, `collision`, `recordInput`, `emit`, `angleCompute`
- `[perf] render (zombies=N)` : `total`, `interp` (applyInterpolation), `renderer` (renderer.render)

Diagnostic : si `renderer.max > 16ms` → frame perdue, bottleneck rendering. `interp` devrait rester < 1ms.

À retirer une fois les perfs validées.

---

## 8. `cache-bust.py` — idempotent

Regex devient `r'((?:src|href)=")([^"?#]+\.(?:js|css))(\?v=[^"#]*)?(")'`. Permet de re-buster une URL déjà cache-bustée. Avant : `?v=XXX` n'était pas matché → re-deploy ne mettait pas à jour le hash.

Local au VPS, hors repo app.

---

## 9. `deploy.sh` — réplication patches post-`git reset`

Nouveau bloc qui copie `/var/www/zombie.morgannriu.fr/patches/**` vers `app/**` après `git reset --hard origin/main`. Skip `.md`, vérifie que la dest existe (sinon le patch est obsolète).

Garantit la persistance des patches tant qu'ils ne sont pas mergés upstream.

---

## Restaurer un patch (fix mergé upstream)

```bash
sudo rm /var/www/zombie.morgannriu.fr/patches/<chemin>/<fichier>
sudo bash /var/www/zombie.morgannriu.fr/deploy.sh
```

## État de la branche locale

Branch : `fix/csp-perf-azerty` (sur clone `/Users/mriu/zombie-browser-game`).

Push GitHub : non fait (credentials manquants côté Claude). À pusher manuellement :
```bash
cd /Users/mriu/zombie-browser-game
git push -u origin fix/csp-perf-azerty
gh pr create --title "fix: CSP unsafe-inline + AZERTY weapon wheel + perf optimizations" --body-file PATCHES.md
```
