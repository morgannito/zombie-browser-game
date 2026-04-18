/**
 * @fileoverview Ring buffer des 100 dernières erreurs in-memory
 */

const MAX_SIZE = 100;
const isProd = () => process.env.NODE_ENV === 'production';

function redactStack(stack) {
  if (!stack) {
return undefined;
}
  if (isProd()) {
return stack.split('\n')[0];
}
  return stack;
}

class ErrorTracker {
  constructor(maxSize = MAX_SIZE) {
    this._maxSize = maxSize;
    this._buffer = [];
  }

  record(err, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
      stack: redactStack(err instanceof Error ? err.stack : undefined),
      context
    };
    this._buffer.push(entry);
    if (this._buffer.length > this._maxSize) {
      this._buffer.shift();
    }
  }

  getRecent(limit = 100) {
    return this._buffer.slice(-limit);
  }

  getSummary() {
    const counts = {};
    for (const entry of this._buffer) {
      counts[entry.message] = (counts[entry.message] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));
  }
}

module.exports = new ErrorTracker();
module.exports.ErrorTracker = ErrorTracker;
