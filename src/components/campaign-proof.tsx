"use client";

import { useEffect, useState } from "react";

import EvidencePacket from "@/components/evidence-packet";
import type {
  CampaignArtifact,
  CampaignProofBundle,
  CampaignRecord,
  GenerationContext,
  MemoryEffect,
} from "@/lib/types";

interface CampaignProofProps {
  campaign: CampaignRecord | null;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onMessage: (message: string, tone?: "info" | "success" | "error") => void;
  onRetry: (sourceId: string) => Promise<void>;
}

interface ApiError {
  error?: { message?: string };
}

function contextFromProof(
  packet: CampaignProofBundle | null,
  campaign: CampaignRecord,
): GenerationContext | undefined {
  const event = packet?.audit.filter((item) => item.type === "MindsResponseReceived").at(-1);
  if (!event) return campaign.generationContext;
  const stringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const memoryEffects = Array.isArray(event.detail.memoryEffects)
    ? event.detail.memoryEffects.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const memory = (item as { memory?: unknown }).memory;
        const effect = (item as { effect?: unknown }).effect;
        return typeof memory === "string" && typeof effect === "string" ? [{ memory, effect }] : [];
      })
    : [];
  return {
    rememberedRules: stringArray(event.detail.rememberedRules),
    avoidedAngles: stringArray(event.detail.avoidedAngles),
    memoryEffects,
    nextReviewQuestion:
      typeof event.detail.nextReviewQuestion === "string" ? event.detail.nextReviewQuestion : null,
    providerFingerprint:
      typeof event.detail.providerFingerprint === "string"
        ? event.detail.providerFingerprint
        : null,
  };
}

function draftParagraphs(body: string): string[] {
  return body
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function CampaignProof({
  campaign,
  busy,
  onRefresh,
  onMessage,
  onRetry,
}: CampaignProofProps) {
  const [feedbackKind, setFeedbackKind] = useState<"edit" | "reject_angle">("reject_angle");
  const [reason, setReason] = useState("Avoid artificial urgency");
  const [feedback, setFeedback] = useState("");
  const [rule, setRule] = useState("");
  const [scope, setScope] = useState("all_public_content");
  const [showFeedback, setShowFeedback] = useState(false);
  const [proofPacket, setProofPacket] = useState<CampaignProofBundle | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofErrorKey, setProofErrorKey] = useState<string | null>(null);
  const [proofLoadedKey, setProofLoadedKey] = useState<string | null>(null);
  const [proofReloadKey, setProofReloadKey] = useState(0);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const campaignId = campaign?.id;
  const campaignUpdatedAt = campaign?.updatedAt;
  const proofRequestKey = `${campaignId ?? "none"}:${campaignUpdatedAt ?? "none"}:${proofReloadKey}`;
  const proofReady = Boolean(
    campaignId && proofLoadedKey === proofRequestKey && proofPacket?.campaign.id === campaignId,
  );
  const currentProofError = proofErrorKey === proofRequestKey ? proofError : null;
  const proofBusy = Boolean(campaignId && !proofReady && !currentProofError);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!campaignId) return () => controller.abort();

    fetch(`/api/campaigns/${campaignId}/proof`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as ApiError & { proof?: CampaignProofBundle };
        if (!response.ok || !payload.proof)
          throw new Error(payload.error?.message ?? "The evidence packet could not be loaded.");
        if (!cancelled) {
          setProofPacket(payload.proof);
          setProofLoadedKey(proofRequestKey);
          setProofError(null);
          setProofErrorKey(null);
        }
      })
      .catch((error) => {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setProofError(
            error instanceof Error ? error.message : "The evidence packet could not be loaded.",
          );
          setProofErrorKey(proofRequestKey);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [campaignId, proofRequestKey]);

  if (!campaign) {
    return (
      <section className="surface campaign-proof empty-proof" aria-labelledby="proof-title">
        <div className="section-kicker">Campaign</div>
        <div className="empty-state">
          <span className="empty-mark">×</span>
          <h2 id="proof-title">No drafts yet</h2>
          <p>Save a source, then ask the configured Mind to build the first reviewable pack.</p>
          <span className="boundary-label">No provider call has been made.</span>
        </div>
      </section>
    );
  }

  const activeCampaign = campaign;
  const artifacts = activeCampaign.artifacts ?? [];
  const generationContext = contextFromProof(proofPacket, activeCampaign);
  const status = statusCopy(activeCampaign.status);

  async function post(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as ApiError & Record<string, unknown>;
    if (!response.ok)
      throw new Error(payload.error?.message ?? "The action could not be completed.");
    return payload;
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = await post(`/api/campaigns/${activeCampaign.id}/feedback`, {
        kind: feedbackKind,
        reason,
        text: feedback,
        proposeRule: rule || undefined,
        scope,
      });
      const acknowledged = Boolean(payload.providerAcknowledged);
      onMessage(
        acknowledged
          ? "Feedback saved and acknowledged by Minds."
          : "Feedback saved locally; Minds has not acknowledged it yet.",
        acknowledged ? "success" : "info",
      );
      setFeedback("");
      setRule("");
      setShowFeedback(false);
      await onRefresh();
      setProofReloadKey((value) => value + 1);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Feedback could not be saved.", "error");
    }
  }

  async function approve() {
    try {
      await post(`/api/campaigns/${activeCampaign.id}/approve`);
      onMessage("Campaign approved locally. No public post was sent.", "success");
      await onRefresh();
      setProofReloadKey((value) => value + 1);
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Approval could not be recorded.",
        "error",
      );
    }
  }

  async function schedule() {
    try {
      const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await post(`/api/campaigns/${activeCampaign.id}/followup`, { dueAt });
      onMessage("Follow-up scheduled for one hour from now. It is not sent yet.", "success");
      await onRefresh();
      setProofReloadKey((value) => value + 1);
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Follow-up could not be scheduled.",
        "error",
      );
    }
  }

  async function downloadProof() {
    if (!proofReady || !proofPacket) {
      onMessage("The local evidence packet is still loading.", "info");
      return;
    }
    setDownloadBusy(true);
    try {
      const blob = new Blob([JSON.stringify(proofPacket, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reeti-${activeCampaign.id.slice(0, 8)}-evidence.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onMessage("Local evidence packet downloaded. Raw source text was excluded.", "success");
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "The evidence packet could not be downloaded.",
        "error",
      );
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <section className="surface campaign-proof" aria-labelledby="proof-title">
      <div className="section-kicker">Campaign</div>
      <div className="section-heading-row">
        <div>
          <div className="title-with-status">
            <h2 id="proof-title">{activeCampaign.source?.title ?? "Untitled campaign"}</h2>
            <span className={`status status-${status.tone}`}>{status.label}</span>
          </div>
          <p className="lede">
            One source, three adaptations. Review them before you share anything.
          </p>
        </div>
        <span className="proof-stamp">
          {activeCampaign.source?.wordCount.toLocaleString() ?? 0} WORDS
        </span>
      </div>

      {activeCampaign.status === "provider_blocked" ? (
        <div className="blocked-panel" role="status">
          <span className="blocked-mark">!</span>
          <div>
            <strong>Generation stopped before success.</strong>
            <p>
              The source receipt and campaign attempt are kept. Configure the real Minds Builder API
              key and Mind ID in the ignored `.env` file, then retry. Reeti does not show invented
              drafts.
            </p>
            <div className="blocked-actions">
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => onRetry(activeCampaign.sourceId)}
              >
                {busy ? "Retrying…" : "Retry generation"}
              </button>
            </div>
          </div>
        </div>
      ) : artifacts.length ? (
        <>
          <section className="adaptations" aria-labelledby="adaptations-title">
            <div className="adaptations-heading">
              <div>
                <div className="section-kicker">Your drafts</div>
                <h3 id="adaptations-title">Three adaptations from one source.</h3>
              </div>
              <span className="adaptations-note">Review before sharing</span>
            </div>
            <div className="adaptation-grid">
              {artifacts.map((item) => (
                <AdaptationCard key={item.id} artifact={item} />
              ))}
            </div>
          </section>
          {generationContext && <ContinuitySignal context={generationContext} />}
          <div className="decision-bar">
            <button
              type="button"
              className="button ghost"
              onClick={() => setShowFeedback((value) => !value)}
            >
              {showFeedback ? "Close revision" : "Revise with feedback"}
            </button>
            <button
              type="button"
              className="button primary"
              onClick={approve}
              disabled={busy || activeCampaign.status === "approved"}
            >
              {activeCampaign.status === "approved" ? "Approved" : "Approve this version"}
            </button>
            <button type="button" className="button outline" onClick={schedule} disabled={busy}>
              Schedule follow-up
            </button>
          </div>
          {showFeedback && (
            <FeedbackForm
              feedbackKind={feedbackKind}
              setFeedbackKind={setFeedbackKind}
              reason={reason}
              setReason={setReason}
              feedback={feedback}
              setFeedback={setFeedback}
              rule={rule}
              setRule={setRule}
              scope={scope}
              setScope={setScope}
              onSubmit={submitFeedback}
            />
          )}
          <GenerationContextPanel
            context={generationContext}
            alias={activeCampaign.mindAlias}
            artifacts={artifacts}
          />
        </>
      ) : (
        <div className="empty-state compact">
          <span className="empty-mark">→</span>
          <strong>Waiting for a provider response</strong>
          <p>Generation is not complete yet.</p>
        </div>
      )}

      <EvidencePacket
        packet={proofReady ? proofPacket : null}
        busy={proofBusy}
        error={currentProofError}
        downloadBusy={downloadBusy}
        onRetry={() => setProofReloadKey((value) => value + 1)}
        onDownload={() => void downloadProof()}
      />
    </section>
  );
}

function ContinuitySignal({ context }: { context: GenerationContext }) {
  const memoryCount = context.rememberedRules.length;
  const avoidedCount = context.avoidedAngles.length;

  return (
    <section className="continuity-signal" aria-labelledby="continuity-signal-title">
      <div className="continuity-signal-copy">
        <div className="section-kicker">Continuity at work</div>
        <h3 id="continuity-signal-title">Your corrections travel with the next source.</h3>
        <p>
          Minds returned the working context for this generation. Reeti keeps the effect visible so
          you can review the reasoning before you approve the drafts.
        </p>
      </div>
      <div className="continuity-signal-stats" aria-label="Generation continuity summary">
        <div>
          <strong>{memoryCount}</strong>
          <span>memories carried in</span>
        </div>
        <div>
          <strong>{avoidedCount}</strong>
          <span>angles kept out</span>
        </div>
      </div>
      <a className="continuity-signal-link" href="#generation-context-title">
        See what changed <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}

function GenerationContextPanel({
  context,
  alias,
  artifacts,
}: {
  context: GenerationContext | undefined;
  alias: string | null;
  artifacts: CampaignArtifact[];
}) {
  const effects = context?.memoryEffects ?? [];
  const memories = context?.rememberedRules ?? [];
  const visibleEffects: MemoryEffect[] = effects.length
    ? effects
    : memories.map((memory) => ({ memory, effect: observedEffect(memory, artifacts) }));

  return (
    <section className="generation-context" aria-labelledby="generation-context-title">
      <div className="generation-context-heading">
        <div>
          <div className="section-kicker">Minds context</div>
          <h3 id="generation-context-title">What Minds carried forward.</h3>
          <p>
            These are the memories returned with this real generation. When Minds supplied an effect
            note, it is shown directly; older records show Reeti&apos;s observed effect.
          </p>
        </div>
        <span className="context-stamp">{alias ? "Minds connected" : "Minds not recorded"}</span>
      </div>

      <div className="generation-context-grid">
        <div>
          <div className="context-list-label">
            {effects.length ? "Memory → effect from Minds" : "Memory → observed effect"}
          </div>
          {visibleEffects.length ? (
            <div className="memory-effects">
              {visibleEffects.map((item, index) => (
                <div className="memory-effect" key={`${item.memory}-${index}`}>
                  <strong>{item.memory}</strong>
                  <span aria-hidden="true">→</span>
                  <p>{item.effect}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="quiet">No remembered rules were returned for this generation.</p>
          )}
        </div>

        <div className="avoided-context">
          <div className="context-list-label">Kept out of this pack</div>
          {context?.avoidedAngles.length ? (
            <ul>
              {context.avoidedAngles.map((angle) => (
                <li key={angle}>{angle}</li>
              ))}
            </ul>
          ) : (
            <p className="quiet">No prior angles were marked as avoided.</p>
          )}
          {context?.nextReviewQuestion && (
            <div className="next-question">
              <span>Next decision</span>
              <p>{context.nextReviewQuestion}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function observedEffect(memory: string, artifacts: CampaignArtifact[]): string {
  const copy = artifacts.map((artifact) => artifact.body).join(" ");
  const lower = memory.toLowerCase();
  if (lower.includes("emoji") && !/\p{Extended_Pictographic}/u.test(copy)) {
    return "All three drafts keep the language emoji-free.";
  }
  if (lower.includes("urgency")) {
    return "The openings use useful detail instead of urgency-based language.";
  }
  if (lower.includes("vague hype") || lower.includes("technical specificity")) {
    return "The adaptations lead with technical detail instead of broad hype.";
  }
  if (lower.includes("customer outcomes") || lower.includes("metrics")) {
    return "No unsupported customer metrics or outcomes appear in the drafts.";
  }
  if (lower.includes("published") || lower.includes("provider boundary")) {
    return "The pack stays review-only; Reeti does not claim that anything was published.";
  }
  if (lower.includes("source as data") || lower.includes("citations")) {
    return "The drafts stay within the source instead of adding unsupported capabilities or citations.";
  }
  return "Reeti carried this exact memory into the generation record; the older response did not return a separate effect note.";
}

function AdaptationCard({ artifact }: { artifact: CampaignArtifact }) {
  const platformLabel =
    artifact.platform === "x"
      ? "X thread"
      : artifact.platform === "linkedin"
        ? "LinkedIn post"
        : "Short-video hooks";

  return (
    <article className={`adaptation-card adaptation-${artifact.platform}`}>
      <div className="adaptation-card-heading">
        <div>
          <span className="adaptation-platform">{platformLabel}</span>
          <h4>{artifact.title}</h4>
        </div>
        <span className="adaptation-mark" aria-hidden="true">
          {artifact.platform === "x" ? "X" : artifact.platform === "linkedin" ? "in" : "▶"}
        </span>
      </div>
      <div className="adaptation-copy">
        {draftParagraphs(artifact.body).map((paragraph, index) => (
          <p key={`${paragraph}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function FeedbackForm(props: {
  feedbackKind: "edit" | "reject_angle";
  setFeedbackKind: (value: "edit" | "reject_angle") => void;
  reason: string;
  setReason: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  rule: string;
  setRule: (value: string) => void;
  scope: string;
  setScope: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="feedback-form" onSubmit={props.onSubmit}>
      <div className="feedback-head">
        <div>
          <span className="section-kicker">Revision</span>
          <h3>What should change?</h3>
        </div>
        <span className="mark red large">×</span>
      </div>
      <div className="feedback-grid">
        <label htmlFor="feedback-kind">
          Decision type
          <select
            id="feedback-kind"
            value={props.feedbackKind}
            onChange={(event) =>
              props.setFeedbackKind(event.target.value as "edit" | "reject_angle")
            }
          >
            <option value="reject_angle">Reject this angle</option>
            <option value="edit">Edit the wording</option>
          </select>
        </label>
        <label htmlFor="feedback-reason">
          Reason
          <select
            id="feedback-reason"
            value={props.reason}
            onChange={(event) => props.setReason(event.target.value)}
          >
            <option>Avoid artificial urgency</option>
            <option>No emojis</option>
            <option>Prefer technical specificity</option>
            <option>Factual correction</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <label htmlFor="feedback-text">
        Creator note
        <textarea
          id="feedback-text"
          value={props.feedback}
          onChange={(event) => props.setFeedback(event.target.value)}
          placeholder="Tell Reeti what to change and why…"
          rows={3}
          required
        />
      </label>
      <div className="policy-proposal">
        <label htmlFor="policy-rule">
          Make this a reusable rule? <span>(optional)</span>
          <input
            id="policy-rule"
            value={props.rule}
            onChange={(event) => props.setRule(event.target.value)}
            placeholder="e.g. Avoid urgency-based openings"
          />
        </label>
        <label htmlFor="policy-scope">
          Scope
          <select
            id="policy-scope"
            value={props.scope}
            onChange={(event) => props.setScope(event.target.value)}
          >
            <option value="all_public_content">All public content</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
            <option value="short_video">Short video</option>
          </select>
        </label>
      </div>
      <div className="form-footer">
        <span className="field-note">
          A proposed rule is not active until you confirm it in the Canon.
        </span>
        <button className="button primary" type="submit">
          Save decision
        </button>
      </div>
    </form>
  );
}

function statusCopy(status: CampaignRecord["status"]): { label: string; tone: string } {
  if (status === "approved") return { label: "Approved", tone: "green" };
  if (status === "provider_blocked") return { label: "Blocked", tone: "red" };
  if (status === "needs_review") return { label: "Review", tone: "yellow" };
  return { label: "Draft", tone: "blue" };
}
