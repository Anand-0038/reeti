"use client";

import { useEffect, useState } from "react";

import EvidencePacket from "@/components/evidence-packet";
import type { CampaignProofBundle, CampaignRecord } from "@/lib/types";

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

export default function CampaignProof({
  campaign,
  busy,
  onRefresh,
  onMessage,
  onRetry,
}: CampaignProofProps) {
  const [activeTab, setActiveTab] = useState<"x" | "linkedin" | "short_video">("x");
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
        <div className="section-kicker">02 / campaign proof</div>
        <div className="empty-state">
          <span className="empty-mark">×</span>
          <h2 id="proof-title">No campaign proof yet</h2>
          <p>Save a source, then ask the configured Mind to build the first reviewable pack.</p>
          <span className="boundary-label">No provider call has been made.</span>
        </div>
      </section>
    );
  }

  const activeCampaign = campaign;
  const artifact = activeCampaign.artifacts?.find((item) => item.platform === activeTab);
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
      <div className="section-kicker">02 / campaign proof</div>
      <div className="section-heading-row">
        <div>
          <div className="title-with-status">
            <h2 id="proof-title">{activeCampaign.source?.title ?? "Untitled campaign"}</h2>
            <span className={`status status-${status.tone}`}>{status.label}</span>
          </div>
          <p className="lede">
            One source, three adaptations, and the decisions that should survive the next session.
          </p>
        </div>
        <span className="proof-stamp">
          {activeCampaign.source?.wordCount.toLocaleString() ?? 0} WORDS
        </span>
      </div>

      <EvidencePacket
        packet={proofReady ? proofPacket : null}
        busy={proofBusy}
        error={currentProofError}
        downloadBusy={downloadBusy}
        onRetry={() => setProofReloadKey((value) => value + 1)}
        onDownload={() => void downloadProof()}
      />

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
      ) : activeCampaign.artifacts?.length ? (
        <>
          <div className="output-tabs" role="tablist" aria-label="Campaign output formats">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "x"}
              className={activeTab === "x" ? "output-tab active" : "output-tab"}
              onClick={() => setActiveTab("x")}
            >
              X thread
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "linkedin"}
              className={activeTab === "linkedin" ? "output-tab active" : "output-tab"}
              onClick={() => setActiveTab("linkedin")}
            >
              LinkedIn
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "short_video"}
              className={activeTab === "short_video" ? "output-tab active" : "output-tab"}
              onClick={() => setActiveTab("short_video")}
            >
              Short hooks
            </button>
          </div>
          <article className="proof-sheet">
            <div className="sheet-meta">
              <span>{artifact?.title}</span>
              <span>source hash {activeCampaign.source?.contentHash.slice(0, 10)}…</span>
            </div>
            <div className="draft-copy">
              {artifact?.body.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="sheet-footer">
              <span>Draft content · review required</span>
              <span>Mind alias: {activeCampaign.mindAlias ?? "not assigned"}</span>
            </div>
          </article>
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
        </>
      ) : (
        <div className="empty-state compact">
          <span className="empty-mark">→</span>
          <strong>Waiting for a provider response</strong>
          <p>Generation is not complete yet.</p>
        </div>
      )}
    </section>
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
          <span className="section-kicker">margin note / new decision</span>
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
  if (status === "approved") return { label: "Approved locally", tone: "green" };
  if (status === "provider_blocked") return { label: "Provider blocked", tone: "red" };
  if (status === "needs_review") return { label: "Needs review", tone: "yellow" };
  return { label: "Draft", tone: "blue" };
}
