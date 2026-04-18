/**
 * Unit tests for lib/server/SkillBonusCache.js
 */

const SkillBonusCache = require('../../../lib/server/SkillBonusCache');

describe('SkillBonusCache', () => {
  test('get_miss_returnsNull', () => {
    const cache = new SkillBonusCache();
    expect(cache.get('p1')).toBeNull();
  });

  test('get_hit_returnsBonuses', () => {
    const cache = new SkillBonusCache();
    const bonuses = { damageMultiplier: 0.5 };
    cache.set('p1', bonuses);
    expect(cache.get('p1')).toBe(bonuses);
  });

  test('get_expired_returnsNull', () => {
    const cache = new SkillBonusCache(5);
    cache.set('p1', { damageMultiplier: 0.5 });
    return new Promise(resolve =>
      setTimeout(() => {
        expect(cache.get('p1')).toBeNull();
        resolve();
      }, 50)
    );
  });

  test('invalidate_removesEntry', () => {
    const cache = new SkillBonusCache();
    cache.set('p1', { damageMultiplier: 0.5 });
    cache.invalidate('p1');
    expect(cache.get('p1')).toBeNull();
  });

  test('invalidate_unknownKey_noError', () => {
    const cache = new SkillBonusCache();
    expect(() => cache.invalidate('unknown')).not.toThrow();
  });

  test('size_reflectsActiveEntries', () => {
    const cache = new SkillBonusCache();
    expect(cache.size).toBe(0);
    cache.set('p1', {});
    cache.set('p2', {});
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  test('set_overwrites_existingEntry', () => {
    const cache = new SkillBonusCache();
    const b1 = { damageMultiplier: 0.2 };
    const b2 = { damageMultiplier: 0.8 };
    cache.set('p1', b1);
    cache.set('p1', b2);
    expect(cache.get('p1')).toBe(b2);
  });
});
