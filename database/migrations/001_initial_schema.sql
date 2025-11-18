-- ================================================================================================
-- MIGRATION 001: Initial Schema
-- Date: 2024-01-01
-- Description: Create initial database schema for zombie multiplayer game
-- ================================================================================================

-- Migration metadata table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Check if migration already applied
INSERT OR IGNORE INTO schema_migrations (version, name)
VALUES (1, '001_initial_schema');

-- Only run if not already applied
-- Note: In production, use a proper migration tool like node-migrate or umzug

-- Run the main schema
.read ../schema.sql