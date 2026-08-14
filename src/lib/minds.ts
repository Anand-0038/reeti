import { createMindsClient } from "@animocabrands/minds-client-lib";

import { ReetiError } from "@/lib/errors";
import { missingMindsConfiguration, serverEnv } from "@/lib/env";
import { generationPrompt, parseGeneratedCampaign } from "@/lib/content";
import type { GeneratedCampaign, LedgerEntry, PolicyRecord, SourceRecord } from "@/lib/types";

export interface MindsPreflight {
  mindId: string;
  mindName: string;
  alias: string;
  enabled: boolean;
}

export interface MindsGateway {
  preflight(): Promise<MindsPreflight>;
  generate(input: {
    source: SourceRecord;
    policies: PolicyRecord[];
    ledger: LedgerEntry[];
  }): Promise<{
    result: GeneratedCampaign;
    providerFingerprint: string | null;
  }>;
  recordFeedback(input: { message: string }): Promise<{ providerFingerprint: string | null }>;
  followup(input: {
    message: string;
  }): Promise<{ message: string; providerFingerprint: string | null }>;
}

function providerFingerprint(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const fingerprint = (value as { fingerprint?: unknown }).fingerprint;
  return typeof fingerprint === "string" ? fingerprint.slice(0, 24) : null;
}

class MissingMindsGateway implements MindsGateway {
  private blocked(): never {
    throw new ReetiError(
      "Minds is not configured for this local project. Add the Builder API key and Mind ID to the ignored .env file.",
      "MINDS_NOT_CONFIGURED",
      503,
      { missing: missingMindsConfiguration() },
    );
  }

  preflight(): Promise<MindsPreflight> {
    return Promise.reject(this.blocked());
  }

  generate(): Promise<{ result: GeneratedCampaign; providerFingerprint: string | null }> {
    return Promise.reject(this.blocked());
  }

  recordFeedback(): Promise<{ providerFingerprint: string | null }> {
    return Promise.reject(this.blocked());
  }

  followup(): Promise<{ message: string; providerFingerprint: string | null }> {
    return Promise.reject(this.blocked());
  }
}

class LiveMindsGateway implements MindsGateway {
  private readonly client = createMindsClient({
    builderApiKey: serverEnv.mindsBuilderApiKey as string,
  });
  private readonly alias = serverEnv.mindsConversationAlias;

  async preflight(): Promise<MindsPreflight> {
    const minds = await this.client.listMinds();
    const configured = serverEnv.mindsMindId
      ? minds.find((mind) => mind.mindId === serverEnv.mindsMindId)
      : minds[0];
    if (!configured) {
      throw new ReetiError(
        "The configured Mind was not found on the Builder account.",
        "MINDS_MIND_NOT_FOUND",
        502,
      );
    }
    if (configured.mindId !== serverEnv.mindsMindId) {
      throw new ReetiError(
        "Set MINDS_MIND_ID explicitly; Reeti will not silently choose a Mind for a release proof.",
        "MINDS_MIND_ID_REQUIRED",
        409,
      );
    }
    await this.client.ensureConversation(this.alias, configured.mindId);
    return {
      mindId: configured.mindId,
      mindName: configured.name ?? "Unnamed Mind",
      alias: this.alias,
      enabled: configured.isEnabled ?? false,
    };
  }

  async generate(input: { source: SourceRecord; policies: PolicyRecord[]; ledger: LedgerEntry[] }) {
    await this.preflight();
    const before = await this.client.getLatestHistoryFingerprint(this.alias);
    const message = generationPrompt(input);
    await this.client.sendMessage({ alias: this.alias, messageText: message });
    const outcome = await this.client.waitForReply({
      alias: this.alias,
      timeoutMs: 180_000,
      afterFingerprint: before,
      sentMessageText: message,
    });
    if (outcome.timedOut || !outcome.reply?.messageText) {
      throw new ReetiError(
        "Minds did not return a reply before the timeout.",
        "MINDS_REPLY_TIMEOUT",
        504,
      );
    }
    return {
      result: parseGeneratedCampaign(outcome.reply.messageText),
      providerFingerprint: providerFingerprint(outcome.reply),
    };
  }

  async recordFeedback(input: { message: string }) {
    await this.preflight();
    const before = await this.client.getLatestHistoryFingerprint(this.alias);
    await this.client.sendMessage({ alias: this.alias, messageText: input.message });
    const outcome = await this.client.waitForReply({
      alias: this.alias,
      timeoutMs: 120_000,
      afterFingerprint: before,
      sentMessageText: input.message,
    });
    if (outcome.timedOut)
      throw new ReetiError(
        "Minds did not acknowledge the feedback before the timeout.",
        "MINDS_FEEDBACK_TIMEOUT",
        504,
      );
    return { providerFingerprint: providerFingerprint(outcome.reply) };
  }

  async followup(input: { message: string }) {
    await this.preflight();
    const before = await this.client.getLatestHistoryFingerprint(this.alias);
    await this.client.sendMessage({ alias: this.alias, messageText: input.message });
    const outcome = await this.client.waitForReply({
      alias: this.alias,
      timeoutMs: 120_000,
      afterFingerprint: before,
      sentMessageText: input.message,
    });
    if (outcome.timedOut || !outcome.reply?.messageText)
      throw new ReetiError(
        "Minds did not return a follow-up before the timeout.",
        "MINDS_FOLLOWUP_TIMEOUT",
        504,
      );
    return {
      message: outcome.reply.messageText,
      providerFingerprint: providerFingerprint(outcome.reply),
    };
  }
}

export function getMindsGateway(): MindsGateway {
  return serverEnv.mindsBuilderApiKey && serverEnv.mindsMindId
    ? new LiveMindsGateway()
    : new MissingMindsGateway();
}
