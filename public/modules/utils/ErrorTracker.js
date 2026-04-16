/**
 * CLIENT ERROR TRACKER
 * Capture window.onerror + unhandledrejection + Performance long-tasks and
 * ship them to /api/v1/client-error with client-side rate limiting and
 * de-duplication so a single render bug can't flood the server.
 *
 * @module ErrorTracker
 */
(function () {
  'use strict';

  const ENDPOINT = '/api/v1/client-error';
  const MAX_REPORTS_PER_MINUTE = 20;
  const DEDUP_WINDOW_MS = 30000;

  if (typeof window === 'undefined') {
    return;
  }

  let sentInWindow = 0;
  let windowResetAt = Date.now() + 60000;
  const recentSignatures = new Map();

  function shouldSend(signature) {
    const now = Date.now();
    if (now > windowResetAt) {
      sentInWindow = 0;
      windowResetAt = now + 60000;
    }
    if (sentInWindow >= MAX_REPORTS_PER_MINUTE) {
      return false;
    }
    const lastSeen = recentSignatures.get(signature);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return false;
    }
    recentSignatures.set(signature, now);
    if (recentSignatures.size > 50) {
      const oldestKey = recentSignatures.keys().next().value;
      recentSignatures.delete(oldestKey);
    }
    sentInWindow++;
    return true;
  }

  function report(payload) {
    const signature =
      (payload.kind || '') + '|' + (payload.message || '') + '|' + (payload.source || '');
    if (!shouldSend(signature)) {
      return;
    }
    const body = JSON.stringify(
      Object.assign(
        {
          ua: navigator.userAgent,
          url: location.href,
          ts: Date.now()
        },
        payload
      )
    );
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }
    } catch (_e) {
      /* fall through to fetch */
    }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {
        /* swallow — error tracker must never throw */
      });
    } catch (_e) {
      /* noop */
    }
  }

  window.addEventListener('error', function (event) {
    const err = event.error;
    report({
      kind: 'error',
      message: event.message || (err && err.message) || 'unknown',
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: err && err.stack ? String(err.stack).slice(0, 2000) : null
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    let message = 'unhandled rejection';
    let stack = null;
    if (reason && typeof reason === 'object') {
      message = reason.message || message;
      stack = reason.stack ? String(reason.stack).slice(0, 2000) : null;
    } else if (typeof reason === 'string') {
      message = reason;
    }
    report({ kind: 'unhandledrejection', message: message, stack: stack });
  });

  // PerformanceObserver: surface long tasks (>50ms blocking the main thread).
  // Rolled up every 30s — a sustained pattern is signal; single stalls aren't.
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      let longTaskCount = 0;
      let longTaskTotalMs = 0;
      let longTaskWindowStart = Date.now();
      const observer = new PerformanceObserver(function (list) {
        const entries = list.getEntries();
        for (let i = 0; i < entries.length; i++) {
          longTaskCount++;
          longTaskTotalMs += entries[i].duration;
        }
      });
      observer.observe({ entryTypes: ['longtask'] });

      setInterval(function () {
        if (longTaskCount === 0) {
          return;
        }
        const elapsedSec = (Date.now() - longTaskWindowStart) / 1000;
        if (longTaskTotalMs > 1000 || longTaskCount > 30) {
          report({
            kind: 'longtask-rollup',
            message:
              longTaskCount +
              ' long tasks, ' +
              Math.round(longTaskTotalMs) +
              'ms over ' +
              Math.round(elapsedSec) +
              's'
          });
        }
        longTaskCount = 0;
        longTaskTotalMs = 0;
        longTaskWindowStart = Date.now();
      }, 30000);
    } catch (_e) {
      /* longtask not supported (Safari < 16) */
    }
  }

  window.__errorTracker = { report: report };
})();
