# Configuration Reference

## Variables d'environnement (config/constants.js)

| Variable | Défaut | Requis en prod | Description |
|----------|--------|----------------|-------------|
| `PORT` | `3000` | Non | Port d'écoute du serveur HTTP |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Non | Origines CORS autorisées, séparées par virgule. Si vide en production → exit(1) |
| `NODE_ENV` | — | Non | `production` active les contrôles stricts (ALLOWED_ORIGINS, METRICS_TOKEN). Désactive `DISABLE_AUTH_RATE_LIMIT` |
| `METRICS_TOKEN` | `null` | **Oui** | Token Bearer pour protéger `/metrics` et `/health`. Absent en production → exit(1) |
| `DISABLE_AUTH_RATE_LIMIT` | — | Non | Mettre `1` pour désactiver le rate-limit d'auth (CI/tests uniquement, ignoré si `NODE_ENV=production`) |

---

## Loaders

| Module | File | Méthode |
|--------|------|---------|
| `ZombieConfig.js` | `lib/server/config/ZombieConfig.js` | Joi validation + `require()` des 4 JSON par catégorie |
| `WeaponConfig.js` | `lib/server/config/WeaponConfig.js` | Joi validation inline |

Les JSON zombies sont dans `lib/server/config/zombies/` (basic, elite, boss, special).  
Les armes sont définies directement dans `WeaponConfig.js`.

---

## Types de Zombies (102 total)

### Catégorie: basic (54)

| ID | Nom | HP | Speed | Damage |
|----|-----|----|-------|--------|
| normal | Zombie Normal | 100 | 2 | 15 |
| fast | Zombie Rapide | 60 | 4.5 | 12 |
| tank | Zombie Tank | 300 | 1.2 | 30 |
| boss | BOSS ZOMBIE | 2000 | 1.8 | 50 |
| inferno | Zombie Inferno | 140 | 2.3 | 22 |
| glacier | Zombie Glacier | 180 | 1.3 | 18 |
| thunderstorm | Zombie Tempete | 120 | 2.6 | 24 |
| boulder | Zombie Rocher | 400 | 0.8 | 40 |
| tornado | Zombie Tornade | 100 | 3.5 | 16 |
| abomination | Abomination | 350 | 1.6 | 38 |
| chimera | Chimere | 280 | 2 | 30 |
| parasite | Zombie Parasite | 90 | 3.2 | 14 |
| cyborg | Zombie Cyborg | 200 | 2.4 | 28 |
| drone | Drone Zombie | 80 | 3.8 | 18 |
| turret | Tourelle Zombie | 180 | 0 | 32 |
| sentinel | Sentinelle | 320 | 1.8 | 36 |
| voidwalker | Marcheur du Vide | 150 | 2.8 | 26 |
| shadowfiend | Ombre Maudite | 130 | 3.2 | 22 |
| hound | Chien Zombie | 70 | 4.2 | 16 |
| raven | Corbeau Zombie | 40 | 5 | 10 |
| rat | Rat Zombie | 25 | 4.5 | 6 |
| spider | Araignee Zombie | 60 | 3 | 12 |
| bear | Ours Zombie | 450 | 1.5 | 48 |
| soldier | Soldat Zombie | 160 | 2 | 26 |
| scientist | Scientifique Zombie | 90 | 1.8 | 18 |
| athlete | Athlete Zombie | 110 | 3.8 | 20 |
| chef | Chef Zombie | 140 | 1.6 | 22 |
| ninja | Ninja Zombie | 100 | 3.6 | 28 |
| vampire | Vampire Zombie | 200 | 2.8 | 32 |
| werewolf | Loup-Garou Zombie | 280 | 3.2 | 40 |
| mummy | Momie Zombie | 220 | 1.2 | 28 |
| skeleton | Squelette Zombie | 80 | 2.6 | 22 |
| ghost | Fantome Zombie | 100 | 2.4 | 24 |
| abyssalHorror | Horreur des Abysses | 260 | 1.8 | 36 |
| locustSwarm | Essaim de Sauterelles | 150 | 2.2 | 18 |
| mantis | Mante Zombie | 140 | 3 | 34 |
| scorpion | Scorpion Zombie | 180 | 2.4 | 28 |
| vineZombie | Zombie Liane | 200 | 0.5 | 24 |
| mushroomZombie | Zombie Champignon | 120 | 1.4 | 16 |
| crystalZombie | Zombie Cristal | 240 | 1.6 | 30 |
| starborn | Ne des Etoiles | 300 | 2.6 | 38 |
| voidSpawn | Progeniture du Vide | 220 | 2.8 | 34 |
| tankZombie | Char Zombie | 600 | 1.1 | 50 |
| helicopter | Helico Zombie | 280 | 3.4 | 36 |
| submarine | Sous-marin Zombie | 400 | 1.8 | 42 |
| greyAlien | Alien Gris Zombie | 160 | 2.4 | 28 |
| xenomorph | Xenomorphe Zombie | 240 | 3.6 | 44 |
| saucer | Soucoupe Zombie | 320 | 2.8 | 38 |
| deepOne | Habitant des Profondeurs | 280 | 2.2 | 36 |
| revenant | Revenant | 260 | 2.4 | 38 |
| wraith | Spectre | 180 | 3 | 32 |
| imp | Diablotin Zombie | 90 | 3.4 | 20 |
| hellhound | Cerbere Zombie | 200 | 3.8 | 36 |

### Catégorie: elite (28)

| ID | Nom | HP | Speed | Damage |
|----|-----|----|-------|--------|
| necromancer | Necromancien | 250 | 1.4 | 18 |
| brute | Brute | 350 | 1.8 | 35 |
| mimic | Mimic | 180 | 3 | 28 |
| splitter | Splitter | 220 | 2.2 | 20 |
| hydra | Zombie Hydre | 220 | 1.8 | 26 |
| titan | Zombie Titan | 600 | 1 | 50 |
| mech | Zombie Mech | 450 | 1.4 | 42 |
| timewraith | Spectre Temporel | 180 | 2 | 30 |
| dimensionBeast | Bete Dimensionnelle | 400 | 2.2 | 44 |
| juggernaut | Juggernaut | 500 | 1.2 | 40 |
| assassin | Assassin | 160 | 4 | 50 |
| warlord | Seigneur de Guerre | 400 | 1.9 | 45 |
| plagueDoctor | Docteur Peste | 300 | 1.6 | 32 |
| reaper | Faucheur | 350 | 2.2 | 55 |
| archon | Archon | 450 | 1.7 | 48 |
| dreadlord | Seigneur de l'Effroi | 480 | 1.8 | 52 |
| stormcaller | Invocateur de Tempete | 320 | 2 | 38 |
| corruptor | Corrupteur | 280 | 1.5 | 34 |
| behemoth | Behemoth | 700 | 0.9 | 65 |
| leviathan | Leviathan Zombie | 800 | 1.4 | 60 |
| treeant | Treant Zombie | 500 | 0.8 | 42 |
| obsidianGolem | Golem d'Obsidienne | 650 | 1 | 55 |
| celestialGuardian | Gardien Celeste | 450 | 2 | 46 |
| shoggoth | Shoggoth | 550 | 1.6 | 48 |
| elderThing | Chose Ancienne | 400 | 1.8 | 42 |
| lich | Liche | 380 | 1.4 | 40 |
| boneLord | Seigneur des Os | 420 | 1.6 | 46 |
| demon | Demon Zombie | 460 | 2 | 52 |
| archdevil | Archidiable | 700 | 2.2 | 70 |

### Catégorie: boss (10)

| ID | Nom | HP | Speed | Damage |
|----|-----|----|-------|--------|
| bossCharnier | RAIIVY | 2500 | 1.5 | 60 |
| bossInfect | SORENZA | 3500 | 2 | 70 |
| bossColosse | HAIER | 5000 | 1.2 | 80 |
| bossRoi | KUROI TO SUTA | 7500 | 1.8 | 100 |
| bossOmega | MORGANNITO | 12000 | 2.2 | 120 |
| bossInfernal | LORD INFERNUS | 8000 | 1.6 | 90 |
| bossCryos | CRYOS L'ETERNEL | 9500 | 1.3 | 85 |
| bossVortex | VORTEX LE DESTRUCTEUR | 10000 | 2 | 100 |
| bossNexus | NEXUS DU VIDE | 11000 | 1.8 | 110 |
| bossApocalypse | APOCALYPSE PRIME | 15000 | 2.4 | 140 |

### Catégorie: special (10)

| ID | Nom | HP | Speed | Damage |
|----|-----|----|-------|--------|
| healer | Zombie Soigneur | 120 | 1.8 | 10 |
| slower | Zombie Ralentisseur | 90 | 2 | 12 |
| shooter | Zombie Tireur | 80 | 1.5 | 20 |
| poison | Zombie Poison | 110 | 2.2 | 18 |
| explosive | Zombie Explosif | 150 | 2.5 | 25 |
| teleporter | Zombie Teleporteur | 95 | 2.8 | 16 |
| summoner | Zombie Invocateur | 140 | 1.4 | 14 |
| shielded | Zombie Bouclier | 180 | 1.6 | 22 |
| berserker | Zombie Berserker | 200 | 2.5 | 20 |
| minion | Mini-Zombie | 30 | 3.5 | 8 |

---

## Types d'Armes (15)

| ID | Nom | Damage | FireRate (ms) | DPS approx | Notes |
|----|-----|--------|---------------|------------|-------|
| pistol | Pistolet | 40 | 180 | ~222 | Arme de départ |
| shotgun | Shotgun | 25×8 | 600 | ~333 | Spread AoE |
| rifle | Fusil d'Assaut | 30 | 120 | ~250 | Mid-tier équilibré |
| sniper | Sniper | 120 | 1200 | ~100 | Portée max, one-shot |
| minigun | Minigun | 12 | 80 | ~150 | Suppression continue |
| launcher | Lance-Roquettes | 80+60 AoE | 1500 | ~53 | explosionRadius 120 |
| flamethrower | Lance-Flammes | 15×3 | 80 | ~562 | Point-blank, lifetime 500ms |
| laser | Laser | 45 | 150 | ~300 | Hitscan, no spread |
| grenadeLauncher | Lance-Grenades | 50+40 AoE | 800 | ~62 | Gravity, explosionRadius 100 |
| crossbow | Arbalete | 90 | 900 | ~100 | Piercing×2 |
| chainLightning | Fusil Eclair | 55 | 700 | ~157 | Chain 4 cibles ×0.7 |
| poisonDart | Flechettes Toxiques | 35 | 450 | ~78 | Poison 3/tick 5s, spread 30% |
| teslaCoil | Bobine Tesla | 12 | 100 | ~600 zone | Range 250px, 5 cibles max |
| iceCannon | Canon de Glace | 65 | 850 | ~76 | Slow 50%, freeze 15% |
| plasmaRifle | Fusil Plasma | 48 | 200 | ~240 | Piercing×3, ignoreWalls |
