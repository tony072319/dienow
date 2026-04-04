-- Cloudflare D1 schema for Sudden Death Index analytics
-- Run: wrangler d1 execute sdi-db --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Core score data
  score       INTEGER NOT NULL,
  grade       TEXT NOT NULL,

  -- 7 dimension scores (0-100 each, higher = worse)
  dim_sleep   INTEGER,
  dim_work    INTEGER,
  dim_exercise INTEGER,
  dim_diet    INTEGER,
  dim_stress  INTEGER,
  dim_habit   INTEGER,
  dim_emotion INTEGER,

  -- Archetype matched
  archetype   TEXT,

  -- User context (anonymous)
  locale      TEXT,        -- 'zh' or 'en'
  age_bucket  TEXT,        -- '18-24', '25-34', '35-44', '45-54', '55+'
  device      TEXT,        -- 'mobile' or 'desktop'
  referrer    TEXT,        -- top-level domain of referrer, or 'direct'
  completion_sec INTEGER,  -- seconds to complete quiz

  -- Challenge mode
  challenge_score INTEGER  -- friend's score if challenge mode, else NULL
);

CREATE INDEX IF NOT EXISTS idx_created_at ON results(created_at);
CREATE INDEX IF NOT EXISTS idx_score ON results(score);
CREATE INDEX IF NOT EXISTS idx_locale ON results(locale);
CREATE INDEX IF NOT EXISTS idx_archetype ON results(archetype);
