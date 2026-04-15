/**
 * @fileoverview Back-compat shim — Logger now lives at infrastructure/logging/.
 * @description Consumers should migrate to `require('infrastructure/logging/Logger')`
 *   (or a relative path equivalent) over time. This shim keeps the legacy
 *   import path working until all 39 call sites have been updated.
 */

module.exports = require('../../infrastructure/logging/Logger');
