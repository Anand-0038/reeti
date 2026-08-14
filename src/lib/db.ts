import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { serverEnv } from "@/lib/env";

const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS creators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    input_type TEXT NOT NULL CHECK(input_type IN ('paste', 'url')),
    source_url TEXT,
    canonical_url TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    source_id TEXT NOT NULL REFERENCES sources(id),
    status TEXT NOT NULL CHECK(status IN ('draft', 'needs_review', 'approved', 'rejected', 'provider_blocked')),
    mind_alias TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    due_at TEXT
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('x', 'linkedin', 'short_video')),
    body TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    artifact_id TEXT REFERENCES artifacts(id),
    kind TEXT NOT NULL CHECK(kind IN ('edit', 'reject_angle', 'approve', 'policy_proposal')),
    reason TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    scope TEXT NOT NULL,
    rule TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('proposed', 'active', 'superseded', 'deleted')),
    priority INTEGER NOT NULL DEFAULT 0,
    source_feedback_id TEXT REFERENCES feedback(id),
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    superseded_by TEXT REFERENCES policies(id)
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('x', 'linkedin', 'short_video')),
    angle TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('approved', 'rejected', 'avoided')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('scheduled', 'running', 'sent', 'failed')),
    idempotency_key TEXT NOT NULL UNIQUE,
    manual_trigger INTEGER NOT NULL DEFAULT 0,
    executed_at TEXT,
    delivery_id TEXT,
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor TEXT NOT NULL CHECK(actor IN ('creator', 'minds', 'worker', 'telegram', 'system')),
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE
  );

  CREATE INDEX IF NOT EXISTS idx_campaigns_updated ON campaigns(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status, creator_id);
`;

type ReetiGlobal = typeof globalThis & { __reetiDatabase?: DatabaseSync };

function databasePath(): string {
  return serverEnv.dbPath ?? join(process.cwd(), "data", "reeti.db");
}

export function getDatabase(): DatabaseSync {
  const globalState = globalThis as ReetiGlobal;
  if (globalState.__reetiDatabase) return globalState.__reetiDatabase;

  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(schema);
  globalState.__reetiDatabase = database;
  return database;
}

export function closeDatabase(): void {
  const globalState = globalThis as ReetiGlobal;
  globalState.__reetiDatabase?.close();
  delete globalState.__reetiDatabase;
}
