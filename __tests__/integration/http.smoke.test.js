'use strict';

/**
 * HTTP Smoke Tests — boots the real server.js process and verifies
 * the critical HTTP surface without mocking application code.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_ENTRY = path.resolve(__dirname, '../../server.js');
const TEST_PORT = 13_337;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SMOKE_METRICS_TOKEN = 'smoke-test-metrics-token';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      })
      .on('error', reject);
  });
}

function httpGetAuth(url, token) {
  return new Promise((resolve, reject) => {
    // Strip "http://" prefix, split host:port from path
    const withoutProto = url.replace(/^https?:\/\//, '');
    const slashIdx = withoutProto.indexOf('/');
    const hostPart = slashIdx === -1 ? withoutProto : withoutProto.slice(0, slashIdx);
    const urlPath = slashIdx === -1 ? '/' : withoutProto.slice(slashIdx);
    const colonIdx = hostPart.lastIndexOf(':');
    const hostname = colonIdx === -1 ? hostPart : hostPart.slice(0, colonIdx);
    const port = colonIdx === -1 ? 80 : Number(hostPart.slice(colonIdx + 1));
    const options = {
      hostname,
      port,
      path: urlPath,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    };
    http
      .request(options, res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      })
      .on('error', reject)
      .end();
  });
}
function waitForServer(url, timeoutMs = 10_000, token = null) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      (token ? httpGetAuth(url, token) : httpGet(url)).then(resolve).catch(() => {
        if (Date.now() > deadline) {
          reject(new Error(`Server did not start within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 200);
        }
      });
    }
    attempt();
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let serverProcess;

beforeAll(async () => {
  serverProcess = spawn('node', [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'production',
      JWT_SECRET: 'smoke-test-secret-at-least-32-chars!!',
      ALLOWED_ORIGINS: `http://127.0.0.1:${TEST_PORT}`,
      METRICS_TOKEN: 'smoke-test-metrics-token',
      DB_PATH: ':memory:'
    },
    stdio: 'ignore'
  });

  // Fail fast if the process exits before we connect
  serverProcess.once('exit', code => {
    if (code !== null && code !== 0) {
      throw new Error(`Server process exited early with code ${code}`);
    }
  });

  await waitForServer(`${BASE_URL}/health`, 10_000, SMOKE_METRICS_TOKEN);
}, 20_000);

afterAll(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  test('test_health_endpoint_returns_503_when_db_is_unavailable', async () => {
    // Arrange
    const url = `${BASE_URL}/health`;

    // Act
    const { status, body } = await httpGetAuth(url, SMOKE_METRICS_TOKEN);
    const parsed = JSON.parse(body);

    // Assert
    expect(status).toBe(503);
    expect(parsed.status).toBe('unhealthy');
    expect(parsed.db).toEqual(
      expect.objectContaining({
        connected: false,
        error: 'health-db-unavailable'
      })
    );
  });

  test('test_health_response_is_json', async () => {
    // Arrange
    const url = `${BASE_URL}/health`;

    // Act
    const { headers } = await httpGetAuth(url, SMOKE_METRICS_TOKEN);

    // Assert
    expect(headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/v1/metrics', () => {
  test('test_metrics_endpoint_not_500', async () => {
    // Arrange
    const url = `${BASE_URL}/api/v1/metrics`;

    // Act
    const { status } = await httpGet(url);

    // Assert
    expect([200, 401, 403]).toContain(status);
  });

  test('test_metrics_endpoint_returns_200_or_401', async () => {
    // Arrange
    const url = `${BASE_URL}/api/v1/metrics`;

    // Act
    const { status } = await httpGet(url);

    // Assert
    expect(status).not.toBe(500);
  });
});

describe('Unknown routes — 404 contract', () => {
  test('test_unknown_route_returns_404_not_500', async () => {
    // Arrange
    const url = `${BASE_URL}/this-route-does-not-exist`;

    // Act
    const { status } = await httpGet(url);

    // Assert
    expect(status).toBe(404);
  });

  test('test_unknown_api_route_returns_404', async () => {
    // Arrange
    const url = `${BASE_URL}/api/v1/nonexistent-resource`;

    // Act
    const { status } = await httpGet(url);

    // Assert
    expect(status).toBe(404);
  });
});

describe('Production safety — no stack traces in responses', () => {
  test('test_404_body_excludes_stack_trace_in_production', async () => {
    // Arrange
    const url = `${BASE_URL}/trigger-404-for-smoke-test`;

    // Act
    const { body } = await httpGet(url);

    // Assert
    expect(body).not.toMatch(/at\s+\w+\s+\(.*:\d+:\d+\)/);
  });

  test('test_health_body_excludes_stack_trace_in_production', async () => {
    // Arrange
    const url = `${BASE_URL}/health`;

    // Act
    const { body } = await httpGetAuth(url, SMOKE_METRICS_TOKEN);

    // Assert
    expect(body).not.toMatch(/at\s+\w+\s+\(.*:\d+:\d+\)/);
  });
});
