export const PLATFORMS = ["x", "linkedin", "short_video"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "provider_blocked",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const POLICY_STATUSES = ["proposed", "active", "superseded", "deleted"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export type SourceInputType = "paste" | "url";
export type FeedbackKind = "edit" | "reject_angle" | "approve" | "policy_proposal";

export interface SourceRecord {
  id: string;
  creatorId: string;
  inputType: SourceInputType;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  title: string;
  body: string;
  contentHash: string;
  wordCount: number;
  createdAt: string;
}

export interface CampaignArtifact {
  id: string;
  campaignId: string;
  platform: Platform;
  body: string;
  title: string;
  position: number;
  createdAt: string;
}

export interface CampaignRecord {
  id: string;
  creatorId: string;
  sourceId: string;
  status: CampaignStatus;
  mindAlias: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  source?: SourceRecord;
  artifacts?: CampaignArtifact[];
  generationContext?: GenerationContext;
}

export interface MemoryEffect {
  memory: string;
  effect: string;
}

export interface GenerationContext {
  rememberedRules: string[];
  avoidedAngles: string[];
  memoryEffects: MemoryEffect[];
  nextReviewQuestion: string | null;
  providerFingerprint: string | null;
}

export interface FeedbackRecord {
  id: string;
  campaignId: string;
  artifactId: string | null;
  kind: FeedbackKind;
  reason: string;
  text: string;
  createdAt: string;
}

export interface PolicyRecord {
  id: string;
  creatorId: string;
  scope: string;
  rule: string;
  status: PolicyStatus;
  priority: number;
  sourceFeedbackId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  supersededBy: string | null;
}

export interface LedgerEntry {
  id: string;
  creatorId: string;
  campaignId: string;
  platform: Platform;
  angle: string;
  decision: "approved" | "rejected" | "avoided";
  createdAt: string;
}

export interface FollowupRecord {
  id: string;
  campaignId: string;
  dueAt: string;
  status: "scheduled" | "running" | "sent" | "failed";
  idempotencyKey: string;
  manualTrigger: boolean;
  executedAt: string | null;
  deliveryId: string | null;
  lastError: string | null;
}

export interface AuditEvent {
  id: string;
  campaignId: string | null;
  type: string;
  actor: "creator" | "minds" | "worker" | "telegram" | "system";
  detail: Record<string, unknown>;
  createdAt: string;
  idempotencyKey: string | null;
}

export interface DashboardData {
  creator: { id: string; name: string };
  campaigns: CampaignRecord[];
  policies: PolicyRecord[];
  ledger: LedgerEntry[];
  audit: AuditEvent[];
  provider: {
    mindsConfigured: boolean;
    telegramConfigured: boolean;
    mindAlias: string;
  };
}

export interface CampaignProofBundle {
  schemaVersion: 1;
  boundary: "local";
  exportedAt: string;
  excludesRawSourceBody: true;
  provider: DashboardData["provider"];
  campaign: {
    id: string;
    sourceId: string;
    status: CampaignStatus;
    mindAlias: string | null;
    createdAt: string;
    updatedAt: string;
    dueAt: string | null;
  };
  source: {
    id: string;
    inputType: SourceInputType;
    sourceUrl: string | null;
    canonicalUrl: string | null;
    title: string;
    contentHash: string;
    wordCount: number;
    createdAt: string;
  };
  artifacts: CampaignArtifact[];
  feedback: FeedbackRecord[];
  policies: PolicyRecord[];
  ledger: LedgerEntry[];
  followups: FollowupRecord[];
  audit: AuditEvent[];
  proof: {
    sourceReceipt: "recorded";
    generation: "artifacts_recorded" | "provider_blocked" | "not_run";
    creatorDecision: "recorded" | "none";
    followUp: "scheduled" | "executed" | "failed" | "mixed" | "none";
  };
}

export interface GeneratedCampaign {
  summary: string;
  xThread: string[];
  linkedin: string;
  shortHooks: string[];
  rememberedRules: string[];
  avoidedAngles: string[];
  memoryEffects: MemoryEffect[];
  nextReviewQuestion: string;
}
