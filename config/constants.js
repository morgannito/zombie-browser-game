/**
 * @fileoverview Configuration constants and environment variables
 * @description Centralizes all server configuration including:
 * - Server port and allowed origins
 * - Rate limiting configuration
 * - Session recovery timeout
 * - Inactivity and heartbeat settings
 */

require('dotenv').config();

// Server port
const PORT = process.env.PORT || 3000;

// Security: Configure allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').filter(o => o.length > 0)
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://zombie.lonewolf.fr',
      'http://zombie.lonewolf.fr'
    ];

// CORS strict validation in production
if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] ALLOWED_ORIGINS must be set in production');
  process.exit(1);
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  shoot: { maxRequests: 10, windowMs: 1000 }, // 10/s — covers fastest weapon
  playerMove: { maxRequests: 60, windowMs: 1000 }, // 60/s — matches 60 FPS client updates
  setNickname: { maxRequests: 3, windowMs: 60000 }, // 3/min — prevents nickname spam
  emote: { maxRequests: 1, windowMs: 1000 }, // 1/s — cosmetic, no need for more
  selectUpgrade: { maxRequests: 10, windowMs: 5000 },
  buyItem: { maxRequests: 20, windowMs: 5000 }, // 4/s eff. — within 5/s target
  shopOpened: { maxRequests: 5, windowMs: 10000 } // Prevent invisible-spam abuse
};

// API Rate limiter configuration
const API_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,

  legacyHeaders: false
};

// Auth rate limiter — 20 attempts / 15 min per IP (brute-force protection).
// `message` is an OBJECT so express-rate-limit responds with JSON (prevents
// the "Unexpected token <" / "pattern" error clients saw on 429).
// Set DISABLE_AUTH_RATE_LIMIT=1 in CI / integration tests to bypass.
const AUTH_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.DISABLE_AUTH_RATE_LIMIT === '1'
};

// Internal monitoring token — required in production for /metrics and /health
// Set METRICS_TOKEN env var; in dev, any request is allowed when token is absent
const METRICS_TOKEN = process.env.METRICS_TOKEN || null;
if (!METRICS_TOKEN && process.env.NODE_ENV === 'production') {
  console.error(
    '[SECURITY] METRICS_TOKEN must be set in production to protect /metrics and /health'
  );
  process.exit(1);
}

// Session recovery timeout (10 minutes — increased for better reconnect resilience)
const SESSION_RECOVERY_TIMEOUT = 10 * 60 * 1000;

// Inactivity timeout (5 minutes — was 2min, too aggressive: dropped players
// in shop / level-up / spectator pause. Heartbeat sweep still runs every 30s.)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// Heartbeat check interval (30 seconds)
const HEARTBEAT_CHECK_INTERVAL = 30 * 1000;

module.exports = {
  PORT,
  ALLOWED_ORIGINS,
  RATE_LIMIT_CONFIG,
  API_LIMITER_CONFIG,
  AUTH_LIMITER_CONFIG,
  METRICS_TOKEN,
  SESSION_RECOVERY_TIMEOUT,
  INACTIVITY_TIMEOUT,
  HEARTBEAT_CHECK_INTERVAL
};
