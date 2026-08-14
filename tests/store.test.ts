import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const databasePath = join(tmpdir(), `reeti-store-${randomUUID()}.db`);
process.env.REETI_DB_PATH = databasePath;

const { closeDatabase } = await import("../src/lib/db.ts");
const {
  addFeedback,
  addLedgerEntry,
  confirmPolicy,
  createCampaign,
  createSource,
  getCampaign,
  listDueFollowups,
  listAudit,
  listPolicies,
  scheduleFollowup,
  saveCampaignArtifacts,
  resetStore,
  markFollowupResult,
  markFollowupRunning,
  proposePolicy,
} = await import("../src/lib/store.ts");
const { approveCampaign } = await import("../src/lib/workflow.ts");

test.after(() => {
  closeDatabase();
  rmSync(databasePath, { force: true });
});

test("local campaign decisions remain persisted and auditable", () => {
  resetStore();
  const source = createSource({
    inputType: "paste",
    title: "A durable source",
    body: "A creator wants each adaptation to preserve the original context and avoid invented claims.",
  });
  const campaign = createCampaign(source.id, "reeti-main");
  const artifacts = saveCampaignArtifacts(campaign.id, [
    { platform: "x", title: "X thread", body: "One idea, carried with context.", position: 0 },
    {
      platform: "linkedin",
      title: "LinkedIn post",
      body: "A reviewable adaptation with provenance.",
      position: 1,
    },
  ]);

  assert.equal(artifacts.length, 2);
  assert.equal(getCampaign(campaign.id)?.status, "needs_review");

  const feedback = addFeedback({
    campaignId: campaign.id,
    artifactId: artifacts[0]?.id,
    kind: "reject_angle",
    reason: "Avoid artificial urgency",
    text: "Keep the opening useful and specific instead of manufacturing pressure.",
  });
  const proposed = proposePolicy({
    feedbackId: feedback.id,
    rule: "Avoid artificial urgency in public content.",
    scope: "all_public_content",
  });
  assert.equal(listPolicies("proposed").length, 1);
  assert.equal(confirmPolicy(proposed.id).status, "active");

  const ledger = addLedgerEntry({
    campaignId: campaign.id,
    platform: "x",
    angle: "manufactured urgency",
    decision: "avoided",
  });
  assert.equal(ledger.decision, "avoided");
  assert.equal(approveCampaign(campaign.id).status, "approved");

  const dueAt = "2020-01-01T00:00:00.000Z";
  const followup = scheduleFollowup(campaign.id, dueAt);
  assert.equal(scheduleFollowup(campaign.id, dueAt).id, followup.id);
  assert.equal(listDueFollowups("2020-01-02T00:00:00.000Z").length, 1);
  markFollowupRunning(followup.id);
  markFollowupResult(followup.id, { status: "failed", error: "Minds not configured" });

  const auditTypes = new Set(listAudit().map((event) => event.type));
  for (const expected of [
    "CampaignStarted",
    "PackGenerated",
    "FeedbackRecorded",
    "PolicyProposed",
    "PolicyConfirmed",
    "LedgerUpdated",
    "PackApproved",
    "FollowupScheduled",
  ]) {
    assert.ok(auditTypes.has(expected), `missing audit event ${expected}`);
  }
});
