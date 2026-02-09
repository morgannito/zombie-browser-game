/**
 * ZOMBIE TYPES EXTENDED - Aggregator
 * Re-exports all zombie type categories as a single flat object
 * Maintains backward compatibility with EXTENDED_ZOMBIE_TYPES
 * @version 2.0.0
 */

const { ELEMENTAL_ZOMBIES } = require('./elemental-zombies');
const { MUTANT_ZOMBIES } = require('./mutant-zombies');
const { MECHANICAL_ZOMBIES } = require('./mechanical-zombies');
const { DIMENSIONAL_ZOMBIES } = require('./dimensional-zombies');

const {
  ANIMAL_ZOMBIES,
  MYTHOLOGICAL_ZOMBIES,
  AQUATIC_ZOMBIES,
  INSECT_ZOMBIES
} = require('./creature-zombies');

const {
  HUMANOID_ZOMBIES,
  PLANT_ZOMBIES,
  CRYSTAL_ZOMBIES,
  COSMIC_ZOMBIES,
  WAR_MACHINE_ZOMBIES
} = require('./thematic-zombies');

const {
  ALIEN_ZOMBIES,
  LOVECRAFTIAN_ZOMBIES,
  UNDEAD_ZOMBIES,
  DEMON_ZOMBIES
} = require('./dark-zombies');

const { ELITE_ZOMBIES } = require('./elite-zombies');
const { BOSS_ZOMBIES } = require('./boss-zombies');

/**
 * Flat map of all extended zombie types.
 * Keys are zombie type identifiers (e.g. 'inferno', 'bossApocalypse').
 * Identical structure to the original EXTENDED_ZOMBIE_TYPES export.
 */
const EXTENDED_ZOMBIE_TYPES = {
  // Elementals
  ...ELEMENTAL_ZOMBIES,
  // Mutants
  ...MUTANT_ZOMBIES,
  // Mechanical
  ...MECHANICAL_ZOMBIES,
  // Dimensional
  ...DIMENSIONAL_ZOMBIES,
  // Bosses
  ...BOSS_ZOMBIES,
  // Elites
  ...ELITE_ZOMBIES,
  // Creatures - Animals
  ...ANIMAL_ZOMBIES,
  // Creatures - Mythological
  ...MYTHOLOGICAL_ZOMBIES,
  // Creatures - Aquatic
  ...AQUATIC_ZOMBIES,
  // Creatures - Insects
  ...INSECT_ZOMBIES,
  // Thematic - Humanoids
  ...HUMANOID_ZOMBIES,
  // Thematic - Plants
  ...PLANT_ZOMBIES,
  // Thematic - Crystals
  ...CRYSTAL_ZOMBIES,
  // Thematic - Cosmic
  ...COSMIC_ZOMBIES,
  // Thematic - War Machines
  ...WAR_MACHINE_ZOMBIES,
  // Dark - Aliens
  ...ALIEN_ZOMBIES,
  // Dark - Lovecraftian
  ...LOVECRAFTIAN_ZOMBIES,
  // Dark - Undead
  ...UNDEAD_ZOMBIES,
  // Dark - Demons
  ...DEMON_ZOMBIES
};

module.exports = {
  EXTENDED_ZOMBIE_TYPES,
  // Category exports for selective imports
  ELEMENTAL_ZOMBIES,
  MUTANT_ZOMBIES,
  MECHANICAL_ZOMBIES,
  DIMENSIONAL_ZOMBIES,
  BOSS_ZOMBIES,
  ELITE_ZOMBIES,
  ANIMAL_ZOMBIES,
  HUMANOID_ZOMBIES,
  MYTHOLOGICAL_ZOMBIES,
  AQUATIC_ZOMBIES,
  INSECT_ZOMBIES,
  PLANT_ZOMBIES,
  CRYSTAL_ZOMBIES,
  COSMIC_ZOMBIES,
  WAR_MACHINE_ZOMBIES,
  ALIEN_ZOMBIES,
  LOVECRAFTIAN_ZOMBIES,
  UNDEAD_ZOMBIES,
  DEMON_ZOMBIES
};
