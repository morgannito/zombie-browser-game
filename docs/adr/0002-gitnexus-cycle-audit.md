# ADR 0002 — GitNexus cycle audit report

**Status:** Informational (audit result)
**Date:** 2026-04-15
**Tool:** `gitnexus cypher` against the indexed repo
**Phase:** 6 (Quality gates) — Phase C of post-refactor improvements

## Scope

Programmatic verification that the refactor's stated architecture holds:

1. No module-level import cycles between files.
2. No cross-layer violations (contexts → server/transport/routes).
3. No reverse-layer imports (infrastructure → contexts).

Index snapshot: **3,679 nodes**, **10,755 edges**, **339 clusters**, **300 flows** (re-audit 2026-04-15 post UX wave).  
Previous snapshot: 3,664 nodes, 10,707 edges, 340 clusters, 300 flows — still 0 cycles, 0 violations.

## Queries run

### Q1 — 2-hop file-level import cycles

```cypher
MATCH (a)-[r1:CodeRelation]->(b)-[r2:CodeRelation]->(a)
WHERE r1.type = 'IMPORTS' AND r2.type = 'IMPORTS'
  AND a.filePath <> b.filePath
RETURN DISTINCT a.filePath, b.filePath
LIMIT 20
```

**Result:** 0 rows ✅

### Q2 — 3-hop file-level import cycles

```cypher
MATCH (a)-[r1:CodeRelation]->(b)-[r2:CodeRelation]->(c)-[r3:CodeRelation]->(a)
WHERE r1.type = 'IMPORTS' AND r2.type = 'IMPORTS' AND r3.type = 'IMPORTS'
  AND a.filePath <> b.filePath AND b.filePath <> c.filePath
RETURN DISTINCT a.filePath, b.filePath, c.filePath
LIMIT 20
```

**Result:** 0 rows ✅

### Q3 — Cross-layer violations (contexts depending up)

```cypher
MATCH (a)-[r:CodeRelation]->(b)
WHERE r.type = 'IMPORTS'
  AND a.filePath STARTS WITH 'contexts/'
  AND (
    b.filePath STARTS WITH 'server/' OR
    b.filePath STARTS WITH 'transport/' OR
    b.filePath STARTS WITH 'routes/'
  )
RETURN DISTINCT a.filePath, b.filePath
LIMIT 20
```

**Result:** 0 rows ✅ (ESLint `no-restricted-imports` enforced — see ADR 0001)

### Q4 — Reverse-layer violations (infrastructure → contexts)

```cypher
MATCH (a)-[r:CodeRelation]->(b)
WHERE r.type = 'IMPORTS'
  AND a.filePath STARTS WITH 'infrastructure/'
  AND b.filePath STARTS WITH 'contexts/'
RETURN DISTINCT a.filePath, b.filePath
LIMIT 10
```

**Result:** 0 rows ✅

## Known self-references (not cycles)

Q0 with `a = b` returns ~20 rows, but all are recursive method calls
within a single file (e.g. `Quadtree.insert` calls itself, `processChainJump`
calls `handleChainLightning` inside `BulletEffects.js`). These are normal
recursion patterns, not inter-module cycles.

## Conclusion

The bounded-context architecture established in Phase 2 holds programmatically:

- No import cycles at 2-hop or 3-hop depth.
- No layer-up violations (contexts never depend on server/transport/routes).
- No layer-reversal violations (infrastructure never depends on contexts).

The ESLint `no-restricted-imports` rules (ADR 0001) are now backed by a
fresh graph audit. Re-run this audit after every structural change:

```bash
gitnexus analyze
gitnexus cypher --repo zombie-browser-game "<query from this ADR>"
```

## Follow-up

None required. This audit is a snapshot — future structural refactors
should re-verify by running the 4 queries above.
