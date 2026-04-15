'use strict';

/**
 * Unit tests — MetricsCollector observability additions
 * Covers: histograms (fps/latency), /metrics/game, /admin/stats builders, MemoryMonitor onCritical, resolveTraceId
 */

describe('MetricsCollector — histogram support', () => {
  let mc;

  beforeEach(() => {
    jest.resetModules();
    const mod = require('../../../../infrastructure/metrics/MetricsCollector');
    mc = mod.getInstance();
    mc.reset();
  });

  test('test_histogram_fps_records_sample', () => {
    mc.recordFpsSample(30);
    expect(mc.histograms.fps.count).toBe(1);
    expect(mc.histograms.fps.sum).toBe(30);
  });

  test('test_histogram_fps_bucket_incremented_correctly', () => {
    mc.recordFpsSample(25);
    expect(mc.histograms.fps.counts[10]).toBe(0);
    expect(mc.histograms.fps.counts[20]).toBe(0);
    expect(mc.histograms.fps.counts[30]).toBe(1);
    expect(mc.histograms.fps.counts[45]).toBe(1);
    expect(mc.histograms.fps.counts['+Inf']).toBe(1);
  });

  test('test_histogram_latency_records_sample', () => {
    mc.recordLatency(42);
    expect(mc.histograms.latency.count).toBe(1);
    expect(mc.histograms.latency.sum).toBe(42);
  });

  test('test_histogram_reset_clears_buckets', () => {
    mc.recordFpsSample(60);
    mc.recordLatency(10);
    mc.reset();
    expect(mc.histograms.fps.count).toBe(0);
    expect(mc.histograms.latency.count).toBe(0);
    expect(mc.histograms.fps.sum).toBe(0);
  });

  test('test_prometheus_output_includes_histogram_fps', () => {
    mc.recordFpsSample(30);
    const output = mc.getPrometheusMetrics();
    expect(output).toMatch(/zombie_fps_bucket/);
    expect(output).toMatch(/zombie_fps_sum/);
    expect(output).toMatch(/zombie_fps_count 1/);
  });

  test('test_prometheus_output_includes_histogram_latency', () => {
    mc.recordLatency(5);
    const output = mc.getPrometheusMetrics();
    expect(output).toMatch(/zombie_request_latency_ms_bucket/);
    expect(output).toMatch(/zombie_request_latency_ms_sum 5/);
  });
});

describe('/metrics/game — buildGameStats', () => {
  test('test_buildGameStats_returns_expected_shape', () => {
    jest.resetModules();
    const { buildGameStats } = require('../../../../transport/http/metrics');
    const mc = require('../../../../infrastructure/metrics/MetricsCollector').getInstance();
    mc.reset();
    const stats = buildGameStats(mc);
    expect(stats).toHaveProperty('waves');
    expect(stats).toHaveProperty('zombies');
    expect(stats).toHaveProperty('powerups');
    expect(stats).toHaveProperty('players');
  });

  test('test_buildGameStats_dropRate_zero_when_no_kills', () => {
    jest.resetModules();
    const { buildGameStats } = require('../../../../transport/http/metrics');
    const mc = require('../../../../infrastructure/metrics/MetricsCollector').getInstance();
    mc.reset();
    const stats = buildGameStats(mc);
    expect(stats.powerups.dropRate).toBe(0);
  });

  test('test_buildGameStats_dropRate_calculated', () => {
    jest.resetModules();
    const { buildGameStats } = require('../../../../transport/http/metrics');
    const mc = require('../../../../infrastructure/metrics/MetricsCollector').getInstance();
    mc.reset();
    mc.incrementZombiesKilled();
    mc.incrementZombiesKilled();
    mc.incrementPowerupsSpawned();
    const stats = buildGameStats(mc);
    expect(stats.powerups.dropRate).toBe(0.5);
  });
});

describe('/admin/stats — buildAdminStats', () => {
  test('test_buildAdminStats_returns_expected_shape', () => {
    jest.resetModules();
    const { buildAdminStats } = require('../../../../transport/http/adminStats');
    const mc = require('../../../../infrastructure/metrics/MetricsCollector').getInstance();
    mc.reset();
    const stats = buildAdminStats(mc, null);
    expect(stats).toHaveProperty('server');
    expect(stats).toHaveProperty('game');
    expect(stats).toHaveProperty('performance');
    expect(stats).toHaveProperty('network');
    expect(stats).toHaveProperty('anticheat');
    expect(stats).toHaveProperty('timestamp');
  });

  test('test_buildAdminStats_memoryTrend_null_when_no_monitor', () => {
    jest.resetModules();
    const { buildAdminStats } = require('../../../../transport/http/adminStats');
    const mc = require('../../../../infrastructure/metrics/MetricsCollector').getInstance();
    mc.reset();
    const stats = buildAdminStats(mc, null);
    expect(stats.memoryTrend).toBeNull();
  });
});

describe('MemoryMonitor — onCritical callback', () => {
  let MemoryMonitor;

  beforeEach(() => {
    jest.resetModules();
    MemoryMonitor = require('../../../../lib/infrastructure/MemoryMonitor');
  });

  test('test_onCritical_not_called_below_threshold', () => {
    const onCritical = jest.fn();
    const mon = new MemoryMonitor({ criticalThresholdMB: 99999, onCritical });
    mon.check();
    expect(onCritical).not.toHaveBeenCalled();
  });

  test('test_onCritical_called_when_threshold_exceeded', () => {
    const onCritical = jest.fn();
    // Use threshold of 1MB — process RSS is always > 1MB
    const mon = new MemoryMonitor({ criticalThresholdMB: 1, onCritical });
    mon.check();
    expect(onCritical).toHaveBeenCalledTimes(1);
    expect(onCritical).toHaveBeenCalledWith(expect.objectContaining({ rss: expect.any(Number) }));
  });

  test('test_onCritical_exception_does_not_throw', () => {
    const onCritical = jest.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const mon = new MemoryMonitor({ criticalThresholdMB: 1, onCritical });
    expect(() => mon.check()).not.toThrow();
  });
});

describe('requestId — resolveTraceId', () => {
  let resolveTraceId;

  beforeEach(() => {
    jest.resetModules();
    ({ resolveTraceId } = require('../../../../middleware/requestId'));
  });

  test('test_resolveTraceId_uses_x_trace_id', () => {
    const id = resolveTraceId({ 'x-trace-id': 'abc-123' });
    expect(id).toBe('abc-123');
  });

  test('test_resolveTraceId_falls_back_to_x_request_id', () => {
    const id = resolveTraceId({ 'x-request-id': 'req-456' });
    expect(id).toBe('req-456');
  });

  test('test_resolveTraceId_generates_uuid_when_no_headers', () => {
    const id = resolveTraceId({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('test_resolveTraceId_prefers_x_trace_id_over_x_request_id', () => {
    const id = resolveTraceId({ 'x-trace-id': 'trace', 'x-request-id': 'req' });
    expect(id).toBe('trace');
  });
});
