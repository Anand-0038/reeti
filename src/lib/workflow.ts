import { z } from "zod";

import { followupPrompt } from "@/lib/content";
import { ReetiError } from "@/lib/errors";
import { getProviderStatus } from "@/lib/env";
import { getMindsGateway } from "@/lib/minds";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  addAuditEvent,
  addFeedback,
  addLedgerEntry,
  confirmPolicy,
  createCampaign,
  createSource,
  getCampaign,
  getDashboard,
  listDueFollowups,
  listFeedback,
  listLedger,
  listPolicies,
  markCampaignProviderBlocked,
  markFollowupResult,
  markFollowupRunning,
  proposePolicy,
  saveCampaignArtifacts,
  scheduleFollowup,
  updateCampaignStatus,
} from "@/lib/store";
import type { DashboardData, FeedbackKind } from "@/lib/types";
import { importPublicUrl, validatePastedSource } from "@/lib/source";

export const sourceRequestSchema = z.object({
  inputType: z.enum(["paste", "url"]),
  title: z.string().max(180).optional(),
  body: z.string().optional(),
  url: z.string().max(2048).optional(),
});

export const feedbackRequestSchema = z.object({
  artifactId: z.string().uuid().nullable().optional(),
  kind: z.enum(["edit", "reject_angle", "approve", "policy_proposal"]),
  reason: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000),
  proposeRule: z.string().trim().max(300).optional(),
  scope: z.string().trim().max(80).optional(),
});

export const scheduleRequestSchema = z.object({
  dueAt: z.string().datetime({ offset: true }),
});

export async function ingestSource(input: unknown) {
  const request = sourceRequestSchema.parse(input);
  if (request.inputType === "paste") {
    if (!request.body)
      throw new ReetiError("Paste the source text before saving it.", "SOURCE_BODY_REQUIRED", 422);
    const parsed = validatePastedSource({ title: request.title, body: request.body });
    return createSource({ inputType: "paste", title: parsed.title, body: parsed.body });
  }
  if (!request.url)
    throw new ReetiError(
      "Enter a public article URL before reading it.",
      "SOURCE_URL_REQUIRED",
      422,
    );
  const imported = await importPublicUrl(request.url);
  return createSource({
    inputType: "url",
    title: imported.title,
    body: imported.body,
    sourceUrl: imported.sourceUrl,
    canonicalUrl: imported.canonicalUrl,
  });
}

export async function generateCampaign(sourceId: string) {
  const campaign = createCampaign(sourceId, getProviderStatus().mindAlias);
  try {
    const source = campaign.source ?? getCampaign(campaign.id)?.source;
    if (!source)
      throw new ReetiError(
        "The source could not be loaded for generation.",
        "SOURCE_NOT_FOUND",
        404,
      );
    const result = await getMindsGateway().generate({
      source,
      policies: listPolicies("active"),
      ledger: listLedger(),
    });
    const artifacts = saveCampaignArtifacts(campaign.id, [
      {
        platform: "x",
        title: `X thread (${result.result.xThread.length})`,
        body: result.result.xThread.join("\n\n"),
        position: 0,
      },
      { platform: "linkedin", title: "LinkedIn post", body: result.result.linkedin, position: 1 },
      {
        platform: "short_video",
        title: "Short-video hooks",
        body: result.result.shortHooks.map((hook, index) => `${index + 1}. ${hook}`).join("\n\n"),
        position: 2,
      },
    ]);
    addAuditEvent(campaign.id, "MindsResponseReceived", "minds", {
      providerFingerprint: result.providerFingerprint,
      rememberedRules: result.result.rememberedRules,
      avoidedAngles: result.result.avoidedAngles,
      nextReviewQuestion: result.result.nextReviewQuestion,
    });
    for (const angle of result.result.avoidedAngles) {
      addLedgerEntry({ campaignId: campaign.id, platform: "x", angle, decision: "avoided" });
    }
    return { campaign: getCampaign(campaign.id), artifacts };
  } catch (error) {
    const publicMessage = error instanceof Error ? error.message : "Minds generation was blocked.";
    const code = error instanceof ReetiError ? error.code : "MINDS_GENERATION_FAILED";
    markCampaignProviderBlocked(campaign.id, code, publicMessage);
    throw error;
  }
}

export async function recordCampaignFeedback(campaignId: string, input: unknown) {
  const request = feedbackRequestSchema.parse(input);
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new ReetiError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  const feedback = addFeedback({
    campaignId,
    artifactId: request.artifactId ?? null,
    kind: request.kind as FeedbackKind,
    reason: request.reason,
    text: request.text,
  });
  let policy = null;
  if (request.proposeRule) {
    policy = proposePolicy({
      feedbackId: feedback.id,
      rule: request.proposeRule,
      scope: request.scope ?? "all_public_content",
    });
  }

  let providerAcknowledged = false;
  let providerError: { code: string; message: string } | null = null;
  try {
    const acknowledgement = await getMindsGateway().recordFeedback({
      message: `Creator feedback for campaign ${campaign.id}: ${request.reason}. ${request.text}. Remember this as context for future editorial reasoning, but do not treat it as an enforceable permanent policy unless the creator confirms it in Reeti.`,
    });
    addAuditEvent(campaignId, "MindsFeedbackAcknowledged", "minds", {
      providerFingerprint: acknowledgement.providerFingerprint,
    });
    providerAcknowledged = true;
  } catch (error) {
    providerError = {
      code: error instanceof ReetiError ? error.code : "MINDS_FEEDBACK_FAILED",
      message: error instanceof Error ? error.message : "Minds did not acknowledge the feedback.",
    };
    addAuditEvent(campaignId, "MindsFeedbackBlocked", "system", providerError);
  }
  return { feedback, policy, providerAcknowledged, providerError };
}

export function confirmCreatorPolicy(policyId: string) {
  return confirmPolicy(policyId);
}

export function approveCampaign(campaignId: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new ReetiError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  if (!campaign.artifacts?.length)
    throw new ReetiError(
      "Generate a campaign before approving it.",
      "CAMPAIGN_HAS_NO_ARTIFACTS",
      409,
    );
  const approved = updateCampaignStatus(campaignId, "approved");
  addAuditEvent(campaignId, "PackApproved", "creator", {
    artifactCount: campaign.artifacts.length,
  });
  return approved;
}

export function scheduleCampaignFollowup(campaignId: string, input: unknown) {
  const request = scheduleRequestSchema.parse(input);
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new ReetiError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  if (campaign.status !== "approved" && campaign.status !== "needs_review") {
    throw new ReetiError(
      "Only a generated or approved campaign can have a follow-up scheduled.",
      "FOLLOWUP_INVALID_STATUS",
      409,
    );
  }
  return scheduleFollowup(campaignId, request.dueAt);
}

export async function runDueFollowups(
  options: { manualTrigger: boolean } = { manualTrigger: false },
): Promise<Array<{ followupId: string; status: string; deliveryId?: string; error?: string }>> {
  const results: Array<{
    followupId: string;
    status: string;
    deliveryId?: string;
    error?: string;
  }> = [];
  for (const followup of listDueFollowups()) {
    markFollowupRunning(followup.id, options.manualTrigger);
    const campaign = getCampaign(followup.campaignId);
    if (!campaign?.source) {
      const error = "The campaign source no longer exists.";
      markFollowupResult(followup.id, { status: "failed", error });
      addAuditEvent(followup.campaignId, "FollowupFailed", "worker", {
        error,
        manualTrigger: options.manualTrigger,
      });
      results.push({ followupId: followup.id, status: "failed", error });
      continue;
    }
    const feedback = listFeedback(campaign.id)[0];
    try {
      const response = await getMindsGateway().followup({
        message: followupPrompt({
          sourceTitle: campaign.source.title,
          latestFeedback: feedback?.text ?? "The creator has not left written feedback yet.",
          pendingQuestion: "Choose one next editorial decision for this campaign.",
        }),
      });
      const delivery = await sendTelegramMessage(response.message);
      markFollowupResult(followup.id, { status: "sent", deliveryId: delivery.messageId });
      addAuditEvent(followup.campaignId, "FollowupExecuted", "worker", {
        manualTrigger: options.manualTrigger,
        providerFingerprint: response.providerFingerprint,
      });
      addAuditEvent(followup.campaignId, "DeliverySucceeded", "telegram", {
        messageId: delivery.messageId,
      });
      results.push({ followupId: followup.id, status: "sent", deliveryId: delivery.messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The follow-up failed.";
      markFollowupResult(followup.id, { status: "failed", error: message });
      addAuditEvent(followup.campaignId, "DeliveryFailed", "worker", {
        manualTrigger: options.manualTrigger,
        code: error instanceof ReetiError ? error.code : "FOLLOWUP_FAILED",
        message,
      });
      results.push({ followupId: followup.id, status: "failed", error: message });
    }
  }
  return results;
}

export function dashboard(): DashboardData {
  return { ...getDashboard(), provider: getProviderStatus() };
}
