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
  shoot: { maxRequests: 20, windowMs: 1000 }, // Hard ceiling: fastest weapon ~20 rps
  playerMove: { maxRequests: 100, windowMs: 1000 }, // Balanced for 60 FPS server with 30 FPS client updates
  setNickname: { maxRequests: 3, windowMs: 10000 },
  selectUpgrade: { maxRequests: 10, windowMs: 5000 },
  buyItem: { maxRequests: 20, windowMs: 5000 },
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

// Auth rate limiter — stricter than global API limiter (brute-force protection)
const AUTH_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP per 15 minutes
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
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

// Inactivity timeout (2 minutes)
const INACTIVITY_TIMEOUT = 2 * 60 * 1000;

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
