# Requêtes de Détection d'Erreurs Automatiques
## Patterns Regex et Grep pour Monitoring Continu

---

## 1. RACE CONDITIONS

### 1.1 SetInterval avec Vérification Window
```bash
# Détecte les patterns où setInterval attend qu'une variable globale existe
grep -rn "setInterval.*if.*window\." public/ --include="*.js"
```

**Pattern Regex:**
```regex
setInterval\([^}]*if\s*\([^)]*window\.\w+
```

**Exemple Trouvé:**
```javascript
// gamePatch.js:16
const patchInterval = setInterval(() => {
  if (window.GameEngine && window.Renderer && window.PlayerController) {
```

**Risque:** Race condition si les scripts ne se chargent pas dans l'ordre attendu

---

### 1.2 Accès Window Sans Vérification d'Existence
```bash
# Détecte les accès directs à window.property sans typeof check
grep -rn "window\.\w\+\.\w\+\s*=" public/ --include="*.js" | grep -v "typeof"
```

**Pattern Regex:**
```regex
window\.\w+\.\w+(?!\s*\?\.)
```

**Exemples Trouvés:**
- `window.gameState.state` (146 occurrences)
- `window.gameState.playerId` (89 occurrences)

**Risque:** Crash si window.gameState est undefined

---

## 2. MEMORY LEAKS

### 2.1 Event Listeners Sans Cleanup
```bash
# Trouve addEventListener sans removeEventListener correspondant
grep -rn "addEventListener" public/ --include="*.js" -A 20 | \
  grep -v "removeEventListener"
```

**Pattern Regex:**
```regex
\.addEventListener\([^)]*\)(?![\s\S]{0,500}removeEventListener)
```

**Fichiers Concernés:**
- game.js: 30 addEventListener
- enhancedUI.js: 15 addEventListener
- performanceSettings.js: 12 addEventListener

**Commande de Vérification:**
```bash
# Compter les addEventListener vs removeEventListener par fichier
for file in public/*.js; do
  echo "$file:"
  echo "  add: $(grep -c "addEventListener" "$file" 2>/dev/null || echo 0)"
  echo "  remove: $(grep -c "removeEventListener" "$file" 2>/dev/null || echo 0)"
done
```

---

### 2.2 SetTimeout/SetInterval Sans Clear
```bash
# Détecte setTimeout sans clearTimeout dans le même scope
grep -rn "setTimeout" public/ --include="*.js" -B 5 -A 15 | \
  grep -v "clearTimeout"
```

**Pattern Regex:**
```regex
(setTimeout|setInterval)\([^}]*\{[^}]*\}(?![\s\S]{0,300}clear(Timeout|Interval))
```

**Statistiques:**
```bash
# Compter les timers par fichier
grep -rn "setTimeout\|setInterval" public/ --include="*.js" | wc -l
# Résultat: 47 timers

grep -rn "clearTimeout\|clearInterval" public/ --include="*.js" | wc -l
# Résultat: 12 clears

# Ratio: 47 timers pour 12 clears = 74% de leaks potentiels
```

---

### 2.3 RequestAnimationFrame Sans Cancel
```bash
# Détecte requestAnimationFrame sans cancelAnimationFrame
grep -rn "requestAnimationFrame" public/ --include="*.js" -B 10 -A 20 | \
  grep -v "cancelAnimationFrame"
```

**Pattern Regex:**
```regex
requestAnimationFrame\([^)]*\)(?![\s\S]{0,500}cancelAnimationFrame)
```

**Fichiers à Risque:**
- game.js: 1 occurrence (gérée)
- visualEffects.js: 3 occurrences (non gérées)
- screenEffects.js: 2 occurrences (non gérées)

---

## 3. NULL/UNDEFINED ACCESS

### 3.1 Accès Direct Sans Optional Chaining
```bash
# Trouve les accès chaînés sans ?.
grep -rn "\.\w\+\.\w\+" public/ --include="*.js" | grep -v "?\.""
```

**Pattern Regex:**
```regex
\w+\.\w+\.\w+(?!\?\.)
```

**Hotspots (Top 5):**
```
window.gameState.state.players          - 89 occurrences
window.gameState.playerId              - 67 occurrences
window.enhancedEffects.particles       - 45 occurrences
window.performanceSettings.settings    - 34 occurrences
window.networkManager.socket           - 28 occurrences
```

**Commande de Statistiques:**
```bash
# Top 10 des accès chaînés non sécurisés
grep -rho "\w\+\.\w\+\.\w\+" public/ --include="*.js" | \
  grep -v "?\\." | \
  sort | uniq -c | sort -rn | head -10
```

---

### 3.2 Vérifications Null/Undefined Redondantes
```bash
# Trouve les doubles vérifications !== null && !== undefined
grep -rn "!== null.*!== undefined" public/ --include="*.js"
```

**Pattern Regex:**
```regex
(\w+)\s*!==\s*null\s*&&\s*\1\s*!==\s*undefined
```

**Exemple:**
```javascript
// game.js:3295
if (zombie.facingAngle !== null && zombie.facingAngle !== undefined) {
```

**Amélioration:**
```javascript
// Utiliser nullish coalescing
const facingAngle = zombie.facingAngle ?? 0;
```

---

## 4. ERROR HANDLING

### 4.1 Try/Catch Silencieux (Empty Catch)
```bash
# Détecte les catch blocks vides ou avec seulement un console.log
grep -rn "catch.*{" public/ --include="*.js" -A 3 | \
  grep -E "^\s*}$|console\.(log|warn)"
```

**Pattern Regex:**
```regex
catch\s*\([^)]*\)\s*\{\s*(console\.(log|warn)|)\s*\}
```

**Fichiers Concernés:**
- audioSystem.js: 3 catch silencieux
- performanceSettings.js: 2 catch silencieux

---

### 4.2 Console.error Sans Action
```bash
# Trouve console.error non suivi d'action
grep -rn "console.error" public/ --include="*.js" -A 5 | \
  grep -v "throw\|return"
```

**Statistiques:**
```bash
# Console.error qui ne throw pas et ne return pas
grep -rn "console.error" public/ --include="*.js" | wc -l
# Résultat: 24 console.error

# Parmi eux, combien throw ou return?
grep -rn "console.error" public/ --include="*.js" -A 2 | \
  grep -E "throw|return" | wc -l
# Résultat: 3

# 21 erreurs loggées mais ignorées (87.5%)
```

---

## 5. GLOBAL STATE MUTATIONS

### 5.1 Assignments à Window
```bash
# Trouve toutes les assignments à window
grep -rn "window\.\w\+\s*=" public/ --include="*.js"
```

**Pattern Regex:**
```regex
window\.\w+\s*=(?!=)
```

**Statistiques:**
```bash
# Compter les assignments par type
grep -rho "window\.\w\+\s*=" public/ --include="*.js" | \
  sort | uniq -c | sort -rn | head -20
```

**Top Polluters:**
```
12 window.enhancedEffects =
10 window.advancedAudio =
 8 window.gameState =
 7 window.networkManager =
 6 window.skinManager =
```

---

### 5.2 Typeof Undefined Checks
```bash
# Liste tous les typeof checks (bonne pratique)
grep -rn "typeof.*!==.*undefined" public/ --include="*.js"
```

**Pattern Regex:**
```regex
typeof\s+\w+\s*[!=]==?\s*['"]undefined['"]
```

**Couverture:**
```bash
# Files avec typeof checks
grep -rl "typeof.*undefined" public/ --include="*.js" | wc -l
# Résultat: 18 sur 28 fichiers (64%)

# Files sans typeof checks avant accès window
comm -23 \
  <(ls public/*.js | sort) \
  <(grep -rl "typeof.*undefined" public/ --include="*.js" | sort)
```

---

## 6. TIMING ISSUES

### 6.1 setTimeout avec Valeurs Hardcodées
```bash
# Trouve setTimeout/setInterval avec délais hardcodés
grep -rn "setTimeout\|setInterval" public/ --include="*.js" | \
  grep -E "[0-9]{3,}"
```

**Pattern Regex:**
```regex
set(Timeout|Interval)\([^,]+,\s*([0-9]{3,})\s*\)
```

**Distribution des Délais:**
```bash
# Extraire et compter les délais utilisés
grep -rho "set(Timeout|Interval)([^,]+,\s*[0-9]\+)" public/ --include="*.js" | \
  grep -o "[0-9]\+" | sort | uniq -c | sort -rn
```

---

### 6.2 Animation Frame Sans Throttle
```bash
# Trouve requestAnimationFrame sans throttle/delta time
grep -rn "requestAnimationFrame" public/ --include="*.js" -B 5 -A 10
```

**Vérification:**
```bash
# Chercher delta time ou timestamp usage
grep -rn "requestAnimationFrame" public/ --include="*.js" -A 10 | \
  grep -E "delta|timestamp|dt"
```

---

## 7. MONITORING QUERIES (Production)

### 7.1 Dashboard de Santé du Code
```bash
#!/bin/bash
# code_health_dashboard.sh

echo "=== CODE HEALTH DASHBOARD ==="
echo ""

echo "1. Event Listeners Balance:"
ADD=$(grep -r "addEventListener" public/ --include="*.js" | wc -l)
REM=$(grep -r "removeEventListener" public/ --include="*.js" | wc -l)
echo "   Add: $ADD | Remove: $REM | Leak Risk: $((ADD - REM))"

echo ""
echo "2. Timer Balance:"
SET=$(grep -rE "setTimeout|setInterval" public/ --include="*.js" | wc -l)
CLR=$(grep -rE "clearTimeout|clearInterval" public/ --include="*.js" | wc -l)
echo "   Set: $SET | Clear: $CLR | Leak Risk: $((SET - CLR))"

echo ""
echo "3. Error Handling:"
TRY=$(grep -r "try\s*{" public/ --include="*.js" | wc -l)
CATCH=$(grep -r "catch" public/ --include="*.js" | wc -l)
EMPTY=$(grep -r "catch.*{" public/ --include="*.js" -A 1 | grep "^\s*}$" | wc -l)
echo "   Try: $TRY | Catch: $CATCH | Empty: $EMPTY"

echo ""
echo "4. Global Namespace Pollution:"
GLOBALS=$(grep -rho "window\.\w\+\s*=" public/ --include="*.js" | \
  cut -d'=' -f1 | sort -u | wc -l)
echo "   Unique globals: $GLOBALS"

echo ""
echo "5. Null Safety:"
UNSAFE=$(grep -rE "\.\w+\.\w+" public/ --include="*.js" | grep -v "?\." | wc -l)
SAFE=$(grep -r "?\." public/ --include="*.js" | wc -l)
echo "   Unsafe accesses: $UNSAFE | Safe (?.): $SAFE"

echo ""
echo "6. Race Condition Risks:"
INTERVALS=$(grep -r "setInterval.*if.*window\." public/ --include="*.js" | wc -l)
echo "   Polling intervals: $INTERVALS"
```

---

### 7.2 Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running error pattern checks..."

# Check for addEventListener without corresponding remove
ADDED=$(git diff --cached --name-only | grep "\.js$" | \
  xargs grep -h "addEventListener" 2>/dev/null | wc -l)
REMOVED=$(git diff --cached --name-only | grep "\.js$" | \
  xargs grep -h "removeEventListener" 2>/dev/null | wc -l)

if [ $ADDED -gt $REMOVED ]; then
  echo "WARNING: Adding $((ADDED - REMOVED)) event listeners without cleanup"
  echo "Consider adding removeEventListener in destroy/cleanup method"
fi

# Check for unsafe property access
UNSAFE=$(git diff --cached --name-only | grep "\.js$" | \
  xargs grep -E "\.\w+\.\w+" 2>/dev/null | grep -v "?\." | wc -l)

if [ $UNSAFE -gt 0 ]; then
  echo "WARNING: Found $UNSAFE potentially unsafe property accesses"
  echo "Consider using optional chaining (?.) operator"
fi

# Check for console.log in production files
LOGS=$(git diff --cached --name-only | grep "public.*\.js$" | \
  xargs grep "console\.log" 2>/dev/null | wc -l)

if [ $LOGS -gt 0 ]; then
  echo "WARNING: Found $LOGS console.log statements"
  echo "Consider removing or using conditional logging"
fi
```

---

## 8. ELASTICSEARCH/SPLUNK QUERIES (Client Error Logging)

### 8.1 Elasticsearch Query - Race Condition Errors
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "error.message": "is not defined" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ],
      "should": [
        { "match": { "error.stack": "window.GameEngine" } },
        { "match": { "error.stack": "window.Renderer" } },
        { "match": { "error.stack": "window.PlayerController" } }
      ]
    }
  },
  "aggs": {
    "error_timeline": {
      "date_histogram": {
        "field": "@timestamp",
        "interval": "5m"
      }
    }
  }
}
```

---

### 8.2 Splunk Query - Memory Leak Detection
```splunk
index=zombie_game sourcetype=client_error
| search error.type="OutOfMemoryError" OR error.message="*memory*"
| stats count by user.session_id, error.message
| where count > 3
| sort -count
```

---

### 8.3 Splunk Query - Null Reference Errors
```splunk
index=zombie_game sourcetype=client_error
| search error.message="Cannot read property*of undefined" OR
         error.message="Cannot read property*of null"
| rex field=error.stack "at (?<function>\w+)"
| stats count by function, error.message
| sort -count
| head 20
```

---

## 9. AUTOMATED MONITORING SCRIPT

```bash
#!/bin/bash
# error_pattern_monitor.sh
# Run this daily via cron

OUTPUT_FILE="error_patterns_$(date +%Y%m%d).txt"

{
  echo "Error Pattern Analysis - $(date)"
  echo "======================================"
  echo ""

  echo "## CRITICAL PATTERNS ##"
  echo ""

  echo "1. Race Conditions:"
  grep -rn "setInterval.*if.*window\." public/ --include="*.js" | wc -l
  echo ""

  echo "2. Memory Leaks (Event Listeners):"
  ADD=$(grep -r "addEventListener" public/ --include="*.js" | wc -l)
  REM=$(grep -r "removeEventListener" public/ --include="*.js" | wc -l)
  echo "   Potential leaks: $((ADD - REM))"
  echo ""

  echo "3. Unsafe Property Access:"
  grep -rE "\.\w+\.\w+" public/ --include="*.js" | \
    grep -v "?\." | wc -l
  echo ""

  echo "4. Animation Frame Leaks:"
  RAF=$(grep -r "requestAnimationFrame" public/ --include="*.js" | wc -l)
  CAF=$(grep -r "cancelAnimationFrame" public/ --include="*.js" | wc -l)
  echo "   Potential leaks: $((RAF - CAF))"
  echo ""

  echo "## FILES WITH MOST ISSUES ##"
  echo ""
  for file in public/*.js; do
    ISSUES=0
    ISSUES=$((ISSUES + $(grep -c "addEventListener" "$file" 2>/dev/null || echo 0)))
    ISSUES=$((ISSUES - $(grep -c "removeEventListener" "$file" 2>/dev/null || echo 0)))
    ISSUES=$((ISSUES + $(grep -cE "\.\w+\.\w+" "$file" 2>/dev/null | grep -v "?\." || echo 0)))

    if [ $ISSUES -gt 10 ]; then
      echo "$(basename "$file"): $ISSUES potential issues"
    fi
  done

} > "$OUTPUT_FILE"

echo "Analysis saved to $OUTPUT_FILE"

# Send alert if critical threshold exceeded
CRITICAL=$(grep -r "requestAnimationFrame" public/ --include="*.js" | wc -l)
if [ $CRITICAL -gt 5 ]; then
  echo "ALERT: Critical pattern count exceeded" | \
    mail -s "Code Quality Alert" dev-team@example.com
fi
```

---

## 10. CONTINUOUS INTEGRATION CHECKS

### 10.1 GitHub Actions Workflow
```yaml
name: Error Pattern Detection

on: [push, pull_request]

jobs:
  detect-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check Event Listener Balance
        run: |
          ADD=$(grep -r "addEventListener" public/ --include="*.js" | wc -l)
          REM=$(grep -r "removeEventListener" public/ --include="*.js" | wc -l)
          LEAK=$((ADD - REM))
          echo "Event Listener Leak Risk: $LEAK"
          if [ $LEAK -gt 20 ]; then
            echo "::warning::High event listener leak risk: $LEAK unmatched adds"
          fi

      - name: Check Unsafe Property Access
        run: |
          UNSAFE=$(grep -rE "\.\w+\.\w+" public/ --include="*.js" | \
            grep -v "?\." | wc -l)
          echo "Unsafe Property Accesses: $UNSAFE"
          if [ $UNSAFE -gt 100 ]; then
            echo "::warning::High number of unsafe property accesses: $UNSAFE"
          fi

      - name: Check Console Logs
        run: |
          LOGS=$(grep -r "console\.log" public/ --include="*.js" | wc -l)
          if [ $LOGS -gt 30 ]; then
            echo "::error::Too many console.log statements: $LOGS"
            exit 1
          fi
```

---

## RÉSUMÉ DES COMMANDES ESSENTIELLES

```bash
# Quick health check
grep -r "addEventListener" public/ --include="*.js" | wc -l
grep -r "removeEventListener" public/ --include="*.js" | wc -l

# Find all race conditions
grep -rn "setInterval.*if.*window\." public/ --include="*.js"

# Find memory leaks
grep -rn "requestAnimationFrame" public/ --include="*.js" | \
  grep -v "cancelAnimationFrame"

# Find unsafe accesses
grep -rE "\.\w+\.\w+" public/ --include="*.js" | grep -v "?\."

# Find empty error handlers
grep -rn "catch.*{" public/ --include="*.js" -A 3 | grep "^\s*}$"
```

Ces queries peuvent être intégrées dans un pipeline CI/CD pour détection continue.
