import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";
import type {
  AuditEvent,
  CampaignArtifact,
  CampaignRecord,
  CampaignStatus,
  FeedbackKind,
  FeedbackRecord,
  FollowupRecord,
  LedgerEntry,
  Platform,
  PolicyRecord,
  PolicyStatus,
  SourceInputType,
  SourceRecord,
} from "@/lib/types";

const LOCAL_CREATOR_ID = "creator-local-workspace";

function now(): string {
  return new Date().toISOString();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function rowToSource(row: Record<string, unknown>): SourceRecord {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    inputType: row.input_type as SourceInputType,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
    title: String(row.title),
    body: String(row.body),
    contentHash: String(row.content_hash),
    wordCount: Number(row.word_count),
    createdAt: String(row.created_at),
  };
}

function rowToArtifact(row: Record<string, unknown>): CampaignArtifact {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    platform: row.platform as Platform,
    body: String(row.body),
    title: String(row.title),
    position: Number(row.position),
    createdAt: String(row.created_at),
  };
}

function rowToCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    sourceId: String(row.source_id),
    status: row.status as CampaignStatus,
    mindAlias: row.mind_alias ? String(row.mind_alias) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    dueAt: row.due_at ? String(row.due_at) : null,
  };
}

function rowToFeedback(row: Record<string, unknown>): FeedbackRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    artifactId: row.artifact_id ? String(row.artifact_id) : null,
    kind: row.kind as FeedbackKind,
    reason: String(row.reason),
    text: String(row.text),
    createdAt: String(row.created_at),
  };
}

function rowToPolicy(row: Record<string, unknown>): PolicyRecord {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    scope: String(row.scope),
    rule: String(row.rule),
    status: row.status as PolicyStatus,
    priority: Number(row.priority),
    sourceFeedbackId: row.source_feedback_id ? String(row.source_feedback_id) : null,
    createdAt: String(row.created_at),
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    supersededBy: row.superseded_by ? String(row.superseded_by) : null,
  };
}

function rowToLedger(row: Record<string, unknown>): LedgerEntry {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    campaignId: String(row.campaign_id),
    platform: row.platform as Platform,
    angle: String(row.angle),
    decision: row.decision as LedgerEntry["decision"],
    createdAt: String(row.created_at),
  };
}

function rowToFollowup(row: Record<string, unknown>): FollowupRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    dueAt: String(row.due_at),
    status: row.status as FollowupRecord["status"],
    idempotencyKey: String(row.idempotency_key),
    manualTrigger: Boolean(row.manual_trigger),
    executedAt: row.executed_at ? String(row.executed_at) : null,
    deliveryId: row.delivery_id ? String(row.delivery_id) : null,
    lastError: row.last_error ? String(row.last_error) : null,
  };
}

function rowToAudit(row: Record<string, unknown>): AuditEvent {
  let detail: Record<string, unknown> = {};
  try {
    detail = JSON.parse(String(row.detail_json)) as Record<string, unknown>;
  } catch {
    detail = { parseError: true };
  }
  return {
    id: String(row.id),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    type: String(row.type),
    actor: row.actor as AuditEvent["actor"],
    detail,
    createdAt: String(row.created_at),
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
  };
}

export function ensureCreator(): { id: string; name: string } {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT id, name FROM creators WHERE id = ?")
    .get(LOCAL_CREATOR_ID) as Record<string, unknown> | undefined;
  if (existing) return { id: String(existing.id), name: String(existing.name) };
  const createdAt = now();
  database
    .prepare("INSERT INTO creators (id, name, created_at) VALUES (?, ?, ?)")
    .run(LOCAL_CREATOR_ID, "Local creator workspace", createdAt);
  return { id: LOCAL_CREATOR_ID, name: "Local creator workspace" };
}

export function createSource(input: {
  inputType: SourceInputType;
  title: string;
  body: string;
  sourceUrl?: string | null;
  canonicalUrl?: string | null;
}): SourceRecord {
  const creator = ensureCreator();
  const body = input.body.trim();
  const record: SourceRecord = {
    id: randomUUID(),
    creatorId: creator.id,
    inputType: input.inputType,
    sourceUrl: input.sourceUrl ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    title: input.title.trim() || "Untitled source",
    body,
    contentHash: hash(body),
    wordCount: body.split(/\s+/).filter(Boolean).length,
    createdAt: now(),
  };
  getDatabase()
    .prepare(
      `INSERT INTO sources
        (id, creator_id, input_type, source_url, canonical_url, title, body, content_hash, word_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.creatorId,
      record.inputType,
      record.sourceUrl,
      record.canonicalUrl,
      record.title,
      record.body,
      record.contentHash,
      record.wordCount,
      record.createdAt,
    );
  addAuditEvent(null, "SourceIngested", "creator", {
    sourceId: record.id,
    contentHash: record.contentHash,
  });
  return record;
}

export function getSource(sourceId: string): SourceRecord | null {
  const row = getDatabase().prepare("SELECT * FROM sources WHERE id = ?").get(sourceId) as
    Record<string, unknown> | undefined;
  return row ? rowToSource(row) : null;
}

export function createCampaign(sourceId: string, mindAlias: string | null): CampaignRecord {
  const source = getSource(sourceId);
  if (!source) throw new Error("Source not found");
  const createdAt = now();
  const record: CampaignRecord = {
    id: randomUUID(),
    creatorId: source.creatorId,
    sourceId,
    status: "draft",
    mindAlias,
    createdAt,
    updatedAt: createdAt,
    dueAt: null,
  };
  getDatabase()
    .prepare(
      "INSERT INTO campaigns (id, creator_id, source_id, status, mind_alias, created_at, updated_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      record.creatorId,
      record.sourceId,
      record.status,
      record.mindAlias,
      record.createdAt,
      record.updatedAt,
      record.dueAt,
    );
  addAuditEvent(record.id, "CampaignStarted", "system", { sourceId });
  return record;
}

export function markCampaignProviderBlocked(
  campaignId: string,
  code: string,
  message: string,
): void {
  const updatedAt = now();
  getDatabase()
    .prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?")
    .run("provider_blocked", updatedAt, campaignId);
  addAuditEvent(campaignId, "GenerationBlocked", "system", { code, message });
}

export function updateCampaignStatus(campaignId: string, status: CampaignStatus): CampaignRecord {
  const updatedAt = now();
  getDatabase()
    .prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, updatedAt, campaignId);
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  return campaign;
}

export function saveCampaignArtifacts(
  campaignId: string,
  artifacts: Array<Pick<CampaignArtifact, "platform" | "body" | "title" | "position">>,
): CampaignArtifact[] {
  const database = getDatabase();
  const createdAt = now();
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM artifacts WHERE campaign_id = ?").run(campaignId);
    for (const artifact of artifacts) {
      database
        .prepare(
          "INSERT INTO artifacts (id, campaign_id, platform, body, title, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          campaignId,
          artifact.platform,
          artifact.body,
          artifact.title,
          artifact.position,
          createdAt,
        );
    }
    database
      .prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?")
      .run("needs_review", createdAt, campaignId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  addAuditEvent(campaignId, "PackGenerated", "minds", { artifactCount: artifacts.length });
  return getArtifacts(campaignId);
}

export function getArtifacts(campaignId: string): CampaignArtifact[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM artifacts WHERE campaign_id = ? ORDER BY position ASC")
    .all(campaignId) as Record<string, unknown>[];
  return rows.map(rowToArtifact);
}

export function getCampaign(campaignId: string): CampaignRecord | null {
  const row = getDatabase().prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as
    Record<string, unknown> | undefined;
  if (!row) return null;
  const campaign = rowToCampaign(row);
  campaign.source = getSource(campaign.sourceId) ?? undefined;
  campaign.artifacts = getArtifacts(campaign.id);
  return campaign;
}

export function listCampaigns(): CampaignRecord[] {
  const creator = ensureCreator();
  const rows = getDatabase()
    .prepare("SELECT * FROM campaigns WHERE creator_id = ? ORDER BY updated_at DESC")
    .all(creator.id) as Record<string, unknown>[];
  return rows.map((row) => {
    const campaign = rowToCampaign(row);
    campaign.source = getSource(campaign.sourceId) ?? undefined;
    campaign.artifacts = getArtifacts(campaign.id);
    return campaign;
  });
}

export function addFeedback(input: {
  campaignId: string;
  artifactId?: string | null;
  kind: FeedbackKind;
  reason: string;
  text: string;
}): FeedbackRecord {
  const record: FeedbackRecord = {
    id: randomUUID(),
    campaignId: input.campaignId,
    artifactId: input.artifactId ?? null,
    kind: input.kind,
    reason: input.reason.trim(),
    text: input.text.trim(),
    createdAt: now(),
  };
  getDatabase()
    .prepare(
      "INSERT INTO feedback (id, campaign_id, artifact_id, kind, reason, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      record.campaignId,
      record.artifactId,
      record.kind,
      record.reason,
      record.text,
      record.createdAt,
    );
  addAuditEvent(record.campaignId, "FeedbackRecorded", "creator", {
    feedbackId: record.id,
    kind: record.kind,
    reason: record.reason,
  });
  return record;
}

export function listFeedback(campaignId: string): FeedbackRecord[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM feedback WHERE campaign_id = ? ORDER BY created_at DESC")
    .all(campaignId) as Record<string, unknown>[];
  return rows.map(rowToFeedback);
}

export function proposePolicy(input: {
  feedbackId: string;
  rule: string;
  scope: string;
}): PolicyRecord {
  const creator = ensureCreator();
  const record: PolicyRecord = {
    id: randomUUID(),
    creatorId: creator.id,
    scope: input.scope,
    rule: input.rule.trim(),
    status: "proposed",
    priority: input.scope === "all_public_content" ? 0 : 10,
    sourceFeedbackId: input.feedbackId,
    createdAt: now(),
    confirmedAt: null,
    supersededBy: null,
  };
  getDatabase()
    .prepare(
      "INSERT INTO policies (id, creator_id, scope, rule, status, priority, source_feedback_id, created_at, confirmed_at, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      record.creatorId,
      record.scope,
      record.rule,
      record.status,
      record.priority,
      record.sourceFeedbackId,
      record.createdAt,
      record.confirmedAt,
      record.supersededBy,
    );
  addAuditEvent(null, "PolicyProposed", "system", {
    policyId: record.id,
    feedbackId: input.feedbackId,
  });
  return record;
}

export function listPolicies(status?: PolicyStatus): PolicyRecord[] {
  const creator = ensureCreator();
  const query = status
    ? "SELECT * FROM policies WHERE creator_id = ? AND status = ? ORDER BY priority DESC, created_at DESC"
    : "SELECT * FROM policies WHERE creator_id = ? ORDER BY created_at DESC";
  const rows = status
    ? getDatabase().prepare(query).all(creator.id, status)
    : getDatabase().prepare(query).all(creator.id);
  return (rows as Record<string, unknown>[]).map(rowToPolicy);
}

export function confirmPolicy(policyId: string): PolicyRecord {
  const database = getDatabase();
  const policy = database.prepare("SELECT * FROM policies WHERE id = ?").get(policyId) as
    Record<string, unknown> | undefined;
  if (!policy) throw new Error("Policy not found");
  const confirmedAt = now();
  database
    .prepare("UPDATE policies SET status = ?, confirmed_at = ? WHERE id = ?")
    .run("active", confirmedAt, policyId);
  addAuditEvent(null, "PolicyConfirmed", "creator", { policyId });
  return rowToPolicy({ ...policy, status: "active", confirmed_at: confirmedAt });
}

export function addLedgerEntry(input: {
  campaignId: string;
  platform: Platform;
  angle: string;
  decision: LedgerEntry["decision"];
}): LedgerEntry {
  const campaign = getCampaign(input.campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const record: LedgerEntry = {
    id: randomUUID(),
    creatorId: campaign.creatorId,
    campaignId: campaign.id,
    platform: input.platform,
    angle: input.angle.trim(),
    decision: input.decision,
    createdAt: now(),
  };
  getDatabase()
    .prepare(
      "INSERT INTO ledger_entries (id, creator_id, campaign_id, platform, angle, decision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      record.creatorId,
      record.campaignId,
      record.platform,
      record.angle,
      record.decision,
      record.createdAt,
    );
  addAuditEvent(record.campaignId, "LedgerUpdated", "system", {
    platform: record.platform,
    decision: record.decision,
  });
  return record;
}

export function listLedger(): LedgerEntry[] {
  const creator = ensureCreator();
  const rows = getDatabase()
    .prepare("SELECT * FROM ledger_entries WHERE creator_id = ? ORDER BY created_at DESC")
    .all(creator.id) as Record<string, unknown>[];
  return rows.map(rowToLedger);
}

export function scheduleFollowup(campaignId: string, dueAt: string): FollowupRecord {
  const idempotencyKey = `followup:${campaignId}:${dueAt}`;
  const existing = getDatabase()
    .prepare("SELECT * FROM followups WHERE idempotency_key = ?")
    .get(idempotencyKey) as Record<string, unknown> | undefined;
  if (existing) return rowToFollowup(existing);

  const record: FollowupRecord = {
    id: randomUUID(),
    campaignId,
    dueAt,
    status: "scheduled",
    idempotencyKey,
    manualTrigger: false,
    executedAt: null,
    deliveryId: null,
    lastError: null,
  };
  getDatabase()
    .prepare(
      "INSERT INTO followups (id, campaign_id, due_at, status, idempotency_key, manual_trigger, executed_at, delivery_id, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      record.id,
      record.campaignId,
      record.dueAt,
      record.status,
      record.idempotencyKey,
      0,
      null,
      null,
      null,
    );
  getDatabase()
    .prepare("UPDATE campaigns SET due_at = ?, updated_at = ? WHERE id = ?")
    .run(dueAt, now(), campaignId);
  addAuditEvent(campaignId, "FollowupScheduled", "creator", {
    dueAt,
    manualTrigger: false,
    idempotencyKey,
  });
  return record;
}

export function listDueFollowups(at = new Date().toISOString()): FollowupRecord[] {
  const rows = getDatabase()
    .prepare(
      "SELECT * FROM followups WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at ASC",
    )
    .all(at) as Record<string, unknown>[];
  return rows.map(rowToFollowup);
}

export function markFollowupRunning(id: string): void {
  getDatabase()
    .prepare("UPDATE followups SET status = ? WHERE id = ? AND status = ?")
    .run("running", id, "scheduled");
}

export function markFollowupResult(
  id: string,
  result: { status: "sent" | "failed"; deliveryId?: string | null; error?: string | null },
): void {
  getDatabase()
    .prepare(
      "UPDATE followups SET status = ?, executed_at = ?, delivery_id = ?, last_error = ? WHERE id = ?",
    )
    .run(result.status, now(), result.deliveryId ?? null, result.error ?? null, id);
}

export function addAuditEvent(
  campaignId: string | null,
  type: string,
  actor: AuditEvent["actor"],
  detail: Record<string, unknown>,
  idempotencyKey: string | null = null,
): AuditEvent {
  const record: AuditEvent = {
    id: randomUUID(),
    campaignId,
    type,
    actor,
    detail,
    createdAt: now(),
    idempotencyKey,
  };
  try {
    getDatabase()
      .prepare(
        "INSERT INTO audit_events (id, campaign_id, type, actor, detail_json, created_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        campaignId,
        type,
        actor,
        JSON.stringify(detail),
        record.createdAt,
        idempotencyKey,
      );
  } catch (error) {
    if (idempotencyKey) {
      const existing = getDatabase()
        .prepare("SELECT * FROM audit_events WHERE idempotency_key = ?")
        .get(idempotencyKey) as Record<string, unknown> | undefined;
      if (existing) return rowToAudit(existing);
    }
    throw error;
  }
  return record;
}

export function listAudit(limit = 50): AuditEvent[] {
  const rows = getDatabase()
    .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToAudit);
}

export function getDashboard(): {
  creator: { id: string; name: string };
  campaigns: CampaignRecord[];
  policies: PolicyRecord[];
  ledger: LedgerEntry[];
  audit: AuditEvent[];
} {
  return {
    creator: ensureCreator(),
    campaigns: listCampaigns(),
    policies: listPolicies(),
    ledger: listLedger(),
    audit: listAudit(),
  };
}

export function resetStore(): void {
  const database = getDatabase();
  database.exec(
    "DELETE FROM audit_events; DELETE FROM followups; DELETE FROM ledger_entries; DELETE FROM policies; DELETE FROM feedback; DELETE FROM artifacts; DELETE FROM campaigns; DELETE FROM sources;",
  );
}
