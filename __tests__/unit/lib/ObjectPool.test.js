'use strict';

const ObjectPool = require('../../../lib/ObjectPool');

function makePool(initialSize = 3) {
  const createFn = () => ({ value: 0 });
  const resetFn = obj => {
    obj.value = 0;
  };
  return new ObjectPool(createFn, resetFn, initialSize);
}

describe('ObjectPool', () => {
  describe('acquire', () => {
    test('test_acquire_fromPrefilled_returnsObject', () => {
      const pool = makePool(2);
      const obj = pool.acquire();
      expect(obj).toBeDefined();
    });

    test('test_acquire_fromPrefilled_recordsHit', () => {
      const pool = makePool(2);
      pool.acquire();
      expect(pool.getStats().hits).toBe(1);
    });

    test('test_acquire_emptyPool_createNewAndRecordsMiss', () => {
      const pool = makePool(0);
      pool.acquire();
      expect(pool.getStats().misses).toBe(1);
    });

    test('test_acquire_emptyPool_incrementsExpansions', () => {
      const pool = makePool(0);
      pool.acquire();
      expect(pool.getStats().expansions).toBe(1);
    });

    test('test_acquire_multipleObjects_tracksInUse', () => {
      const pool = makePool(5);
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().inUse).toBe(2);
    });

    test('test_acquire_peakUsage_updatesCorrectly', () => {
      const pool = makePool(5);
      pool.acquire();
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().peakUsage).toBe(3);
    });
  });

  describe('release', () => {
    test('test_release_knownObject_removesFromInUse', () => {
      const pool = makePool(3);
      const obj = pool.acquire();
      pool.release(obj);
      expect(pool.getStats().inUse).toBe(0);
    });

    test('test_release_knownObject_returnsToAvailable', () => {
      const pool = makePool(1);
      const before = pool.getStats().available;
      const obj = pool.acquire();
      pool.release(obj);
      expect(pool.getStats().available).toBe(before);
    });

    test('test_release_knownObject_incrementsReleaseCount', () => {
      const pool = makePool(3);
      const obj = pool.acquire();
      pool.release(obj);
      expect(pool.getStats().releases).toBe(1);
    });

    test('test_release_knownObject_callsResetFn', () => {
      const createFn = () => ({ value: 42 });
      const resetFn = jest.fn(obj => {
        obj.value = 0;
      });
      const pool = new ObjectPool(createFn, resetFn, 1);
      const obj = pool.acquire();
      pool.release(obj);
      expect(resetFn).toHaveBeenCalledWith(obj);
    });

    test('test_release_unknownObject_doesNotThrow', () => {
      const pool = makePool(2);
      const stranger = { value: 99 };
      expect(() => pool.release(stranger)).not.toThrow();
    });
  });

  describe('releaseAll', () => {
    test('test_releaseAll_multipleInUse_clearsInUseSet', () => {
      const pool = makePool(5);
      pool.acquire();
      pool.acquire();
      pool.releaseAll();
      expect(pool.getStats().inUse).toBe(0);
    });
  });

  describe('getStats', () => {
    test('test_getStats_noAcquires_hitRateIsZero', () => {
      const pool = makePool(3);
      expect(pool.getStats().hitRate).toBe('0.00%');
    });

    test('test_getStats_allHits_hitRateIsHundredPercent', () => {
      const pool = makePool(5);
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().hitRate).toBe('100.00%');
    });

    test('test_getStats_totalCreated_matchesInitialSize', () => {
      const pool = makePool(7);
      expect(pool.getStats().totalCreated).toBe(7);
    });
  });

  describe('resetMetrics', () => {
    test('test_resetMetrics_afterActivity_setsHitsToZero', () => {
      const pool = makePool(3);
      pool.acquire();
      pool.resetMetrics();
      expect(pool.getStats().hits).toBe(0);
    });

    test('test_resetMetrics_afterActivity_setsMissesToZero', () => {
      const pool = makePool(0);
      pool.acquire();
      pool.resetMetrics();
      expect(pool.getStats().misses).toBe(0);
    });
  });
});
