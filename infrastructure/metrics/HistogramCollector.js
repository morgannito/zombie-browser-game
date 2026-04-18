/**
 * HISTOGRAM COLLECTOR
 * Gère les histogrammes Prometheus (tick_duration, broadcast_duration, fps, latency, gc…)
 */

const logger = require('../logging/Logger');

class HistogramCollector {
  constructor() {
    this.histograms = {
      fps: { buckets: [10, 20, 30, 45, 60, 90, 120], counts: {}, sum: 0, count: 0 },
      latency: { buckets: [1, 5, 10, 25, 50, 100, 250, 500], counts: {}, sum: 0, count: 0 },
      broadcast_ms: { buckets: [1, 2, 5, 10, 20, 50, 100], counts: {}, sum: 0, count: 0 },
      broadcast_bytes: { buckets: [1024, 4096, 16384, 65536, 262144, 1048576], counts: {}, sum: 0, count: 0 },
      gc_pause_ms: { buckets: [1, 5, 10, 25, 50, 100, 250], counts: {}, sum: 0, count: 0 },
      tick_duration_ms: { buckets: [1, 2, 5, 10, 16, 25, 50], counts: {}, sum: 0, count: 0 }
    };
    this._initBuckets();
    this._installGcObserver();
  }

  _initBuckets() {
    for (const hist of Object.values(this.histograms)) {
      for (const b of hist.buckets) {
        hist.counts[b] = 0;
      }
      hist.counts['+Inf'] = 0;
    }
  }

  record(name, value) {
    const hist = this.histograms[name];
    if (!hist) {
return;
}
    hist.sum += value;
    hist.count++;
    for (const b of hist.buckets) {
      if (value <= b) {
hist.counts[b]++;
}
    }
    hist.counts['+Inf']++;
  }

  recordFpsSample(fps)           {
 this.record('fps', fps);
}
  recordLatency(ms)              {
 this.record('latency', ms);
}
  recordBroadcastDuration(ms)    {
 this.record('broadcast_ms', ms);
}
  recordTickDuration(ms)         {
 this.record('tick_duration_ms', ms);
}
  recordBroadcastBytes(bytes)    {
 this.record('broadcast_bytes', bytes);
}
  recordGcPause(ms)              {
 this.record('gc_pause_ms', ms);
}

  _installGcObserver() {
    try {
      const { PerformanceObserver, constants } = require('perf_hooks');
      this._gcObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (Number.isFinite(entry.duration) && entry.duration > 0) {
            this.recordGcPause(entry.duration);
          }
        }
      });
      this._gcObserver.observe({ entryTypes: ['gc'], buffered: false });
      this._gcKinds = constants;
    } catch (e) {
      logger.warn('[HistogramCollector] GC observer unavailable', { err: e.message });
    }
  }

  reset() {
    for (const hist of Object.values(this.histograms)) {
      hist.sum = 0;
      hist.count = 0;
      for (const key of Object.keys(hist.counts)) {
        hist.counts[key] = 0;
      }
    }
  }
}

module.exports = HistogramCollector;
