/**
 * @fileoverview Weapons bounded context — public facade.
 * @description Bullets, collisions, damage effects. Internal modules live in
 *   contexts/weapons/modules/; consumers should import from this entry point
 *   or from the explicit CollisionManager file.
 */

const CollisionManager = require('./CollisionManager');
const { updateBullets } = require('./modules/BulletUpdater');

module.exports = { CollisionManager, updateBullets };
