/**
 * @fileoverview Central JSDoc type definitions for the zombie game
 * @description Shared @typedef declarations for all critical game entities.
 *   Import with: `@type {import('../types/jsdoc-types').TypeName}`
 */

/**
 * @typedef {Object} PlayerUpgrades
 * @property {number} maxHealth
 * @property {number} damage
 * @property {number} speed
 * @property {number} fireRate
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} socketId
 * @property {string|null} sessionId
 * @property {string|null} accountId
 * @property {string|null} nickname
 * @property {boolean} hasNickname
 * @property {boolean} spawnProtection
 * @property {number} spawnProtectionEndTime
 * @property {boolean} invisible
 * @property {number} invisibleEndTime
 * @property {number} lastActivityTime
 * @property {number} x
 * @property {number} y
 * @property {number} health
 * @property {number} maxHealth
 * @property {number} level
 * @property {number} xp
 * @property {number} gold
 * @property {boolean} alive
 * @property {number} angle
 * @property {string} weapon
 * @property {number} lastShot
 * @property {Object|null} speedBoost
 * @property {Object|null} weaponTimer
 * @property {number} kills
 * @property {number} zombiesKilled
 * @property {number} combo
 * @property {number} comboTimer
 * @property {number} highestCombo
 * @property {number} totalScore
 * @property {number} survivalTime
 * @property {PlayerUpgrades} upgrades
 * @property {number} damageMultiplier
 * @property {number} speedMultiplier
 * @property {number} fireRateMultiplier
 * @property {number} regeneration
 * @property {number} bulletPiercing
 * @property {number} lifeSteal
 * @property {number} criticalChance
 * @property {number} goldMagnetRadius
 * @property {number} dodgeChance
 * @property {number} explosiveRounds
 * @property {number} explosionRadius
 * @property {number} explosionDamagePercent
 * @property {number} extraBullets
 * @property {number} thorns
 * @property {number} lastRegenTick
 * @property {number} autoTurrets
 * @property {number} lastAutoShot
 */

/**
 * @typedef {Object} Zombie
 * @property {number} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {number} health
 * @property {number} maxHealth
 * @property {number} speed
 * @property {number} baseSpeed
 * @property {number} damage
 * @property {string} color
 * @property {number} size
 * @property {number} goldDrop
 * @property {number} xpDrop
 * @property {boolean} isElite
 * @property {boolean} [isBoss]
 * @property {boolean} [isMinion]
 * @property {boolean} [isSummoned]
 * @property {number} [summonerId]
 * @property {number} [lastHeal]
 * @property {number} [lastShot]
 * @property {number} [lastPoisonTrail]
 * @property {number} [lastTeleport]
 * @property {number} [lastSummon]
 * @property {number} [minionCount]
 * @property {number} [facingAngle]
 * @property {boolean} [isRaged]
 * @property {boolean} [isExtremeRaged]
 * @property {number} [lastDash]
 * @property {boolean} [isDashing]
 * @property {number} [dashEndTime]
 * @property {number} [lastResurrect]
 * @property {number} [lastCharge]
 * @property {boolean} [isCharging]
 * @property {number} [chargeEndTime]
 * @property {number} [chargeAngle]
 * @property {boolean} [isRevealed]
 * @property {boolean} [disguised]
 * @property {boolean} [firstAttack]
 * @property {number} [lastSpawn]
 * @property {number} [lastToxicPool]
 * @property {boolean} [isEnraged]
 * @property {number} [phase]
 * @property {number} [lastLaser]
 */

/**
 * @typedef {Object} Bullet
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} damage
 * @property {string} color
 * @property {number} size
 * @property {string|null} playerId
 * @property {string|null} zombieId
 * @property {number} piercing
 * @property {number[]} piercedZombies
 * @property {boolean} explosiveRounds
 * @property {number} explosionRadius
 * @property {number} explosionDamagePercent
 * @property {number} rocketExplosionDamage
 * @property {boolean} isAutoTurret
 * @property {boolean} isRocket
 * @property {boolean} isZombieBullet
 * @property {boolean} isFlame
 * @property {boolean} isLaser
 * @property {boolean} isGrenade
 * @property {boolean} isCrossbow
 * @property {number} gravity
 * @property {number|null} lifetime
 * @property {number} lastUpdateTime
 * @property {number} createdAt
 * @property {number} spawnCompensationMs
 * @property {boolean} _trailInitialized
 */

/**
 * @typedef {Object} Powerup
 * @property {number} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {number} lifetime - Expiry timestamp (Date.now() + duration)
 */

/**
 * @typedef {Object} MutatorEffects
 * @property {number} zombieHealthMultiplier
 * @property {number} zombieDamageMultiplier
 * @property {number} zombieSpeedMultiplier
 * @property {number} spawnCountMultiplier
 * @property {number} spawnIntervalMultiplier
 * @property {number} playerDamageMultiplier
 * @property {number} playerFireRateCooldownMultiplier
 */

/**
 * @typedef {Object} PermanentUpgrades
 * @property {number} maxHealthUpgrade
 * @property {number} damageUpgrade
 * @property {number} speedUpgrade
 * @property {number} goldMultiplier
 */

/**
 * @typedef {Object} GameState
 * @property {Object.<string, PlayerState>} players
 * @property {Object.<number, Zombie>} zombies
 * @property {Object.<number, Bullet>} bullets
 * @property {Object.<number, Powerup>} powerups
 * @property {Object.<number, Object>} particles
 * @property {Object.<number, Object>} poisonTrails
 * @property {Object.<number, Object>} loot
 * @property {Object.<number, Object>} explosions
 * @property {Object[]} walls
 * @property {Object[]} rooms
 * @property {number} currentRoom
 * @property {boolean} bossSpawned
 * @property {number} nextZombieId
 * @property {number} nextBulletId
 * @property {number} nextPowerupId
 * @property {number} nextParticleId
 * @property {number} nextPoisonTrailId
 * @property {number} nextLootId
 * @property {number} nextExplosionId
 * @property {number} wave
 * @property {number} zombiesKilledThisWave
 * @property {number} zombiesSpawnedThisWave
 * @property {Object[]} activeMutators
 * @property {MutatorEffects} mutatorEffects
 * @property {number} nextMutatorWave
 * @property {PermanentUpgrades} permanentUpgrades
 * @property {function(string): number} getNextId
 */
