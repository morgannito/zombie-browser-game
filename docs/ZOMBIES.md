# Types de Zombies

12 types représentatifs issus des 4 fichiers de configuration.

## Basic (`basic.json`)

| # | Nom | HP | Vitesse | Dégâts | Capacités spéciales |
|---|-----|----|---------|--------|---------------------|
| 1 | Zombie Normal | 100 | 2.0 | 15 | Aucune — zombie de base |
| 2 | Zombie Rapide | 60 | 4.5 | 12 | Vitesse élevée, faible résistance |
| 3 | Zombie Tank | 300 | 1.2 | 30 | Haute résistance, lent |

## Elite (`elite.json`)

| # | Nom | HP | Vitesse | Dégâts | Capacités spéciales |
|---|-----|----|---------|--------|---------------------|
| 4 | Nécromancien | 250 | 1.4 | 18 | Ressuscite 2 zombies morts (cooldown 8s, portée 300) |
| 5 | Brute | 350 | 1.8 | 35 | Charge dévastatrice (vitesse ×6, stun 1.5s, portée 500) |
| 6 | Mimic | 180 | 3.0 | 28 | Se déguise en ressource ; révèle à 150px, dégâts d'embuscade ×2 |
| 7 | Splitter | 220 | 2.2 | 20 | À la mort : se divise en 3 clones (30% HP, vitesse ×1.5, dégâts ×0.5) |

## Boss (`boss.json`)

| # | Nom | HP | Vitesse | Dégâts | Capacités spéciales |
|---|-----|----|---------|--------|---------------------|
| 8 | SORENZA | 3500 | 2.0 | 70 | Crée des mares toxiques (dmg 15/tick, durée 8s) ; aura de mort (rayon 80) |
| 9 | HAIER | 5000 | 1.2 | 80 | Bouclier (-80% dégâts) ; enrage à 30% HP (vitesse ×2, dégâts ×1.5) |
| 10 | KUROI TO SUTA | 7500 | 1.8 | 100 | 3 phases, téléportation (cd 8s), invocation de clones, convocation de minions |

## Special (`special.json`)

| # | Nom | HP | Vitesse | Dégâts | Capacités spéciales |
|---|-----|----|---------|--------|---------------------|
| 11 | Zombie Explosif | 150 | 2.5 | 25 | Explosion à la mort (rayon 150, 80 dégâts) |
| 12 | Zombie Berserker | 200 | 2.5 | 20 | Rage à 50% HP (vitesse ×1.5, dégâts ×1.3) ; rage extrême à 25% HP (×2.0 / ×1.6) + dash |

---

> **Note** : les 4 fichiers contiennent en réalité 50+ types au total. Ce tableau liste les 12 archétypes les plus représentatifs de chaque catégorie.
