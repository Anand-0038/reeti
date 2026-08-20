"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import CampaignProof from "@/components/campaign-proof";
import ContinuityRecord from "@/components/continuity-record";
import MemoryMargin from "@/components/memory-margin";
import SourceDesk from "@/components/source-desk";
import type { CampaignRecord, DashboardData, SourceRecord } from "@/lib/types";

type Surface = "proof" | "canon" | "continuity";

interface ApiError {
  error?: { message?: string; details?: Record<string, unknown> };
}

export default function ReetiWorkbench() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<SourceRecord | null>(null);
  const [surface, setSurface] = useState<Surface>("proof");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  const showMessage = useCallback((text: string, tone: "info" | "success" | "error" = "info") => {
    setMessage({ text, tone });
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = (await response.json()) as DashboardData & ApiError;
    if (!response.ok || !payload.campaigns)
      throw new Error(payload.error?.message ?? "The local workspace could not be loaded.");
    setData(payload);
    setSelectedCampaignId((current) => {
      if (current) return current;
      const firstReady = payload.campaigns.find((campaign) => campaign.artifacts?.length);
      return firstReady?.id ?? payload.campaigns[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh().catch((error: unknown) =>
        showMessage(
          error instanceof Error ? error.message : "The local workspace could not be loaded.",
          "error",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, showMessage]);

  const selectedCampaign = useMemo<CampaignRecord | null>(() => {
    if (!data || !selectedCampaignId) return null;
    return data.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  }, [data, selectedCampaignId]);

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function buildCampaign(sourceId = source?.id) {
    if (!sourceId) return;
    await withBusy(async () => {
      showMessage("Building campaign through the configured Mind…");
      try {
        const response = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }),
        });
        const payload = (await response.json()) as ApiError & { campaign?: CampaignRecord };
        if (!response.ok)
          throw new Error(payload.error?.message ?? "Campaign generation was blocked.");
        await refresh();
        setSource(null);
        if (payload.campaign?.id) setSelectedCampaignId(payload.campaign.id);
        showMessage("Campaign generated. Review the three drafts.", "success");
      } catch (error) {
        await refresh().catch(() => undefined);
        setSource(null);
        showMessage(
          error instanceof Error ? error.message : "Campaign generation was blocked.",
          "error",
        );
      }
    });
  }

  async function confirmPolicy(policyId: string) {
    await withBusy(async () => {
      try {
        const response = await fetch(`/api/policies/${policyId}/confirm`, { method: "POST" });
        const payload = (await response.json()) as ApiError;
        if (!response.ok)
          throw new Error(payload.error?.message ?? "The policy could not be confirmed.");
        await refresh();
        showMessage("Rule confirmed in Creator rules.", "success");
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "The policy could not be confirmed.",
          "error",
        );
      }
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workbench" aria-label="Reeti home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 56 56" focusable="false">
              <rect x="2" y="2" width="52" height="52" rx="14" fill="currentColor" />
              <path
                d="M18 43V13h10.5c6.9 0 11.5 3.8 11.5 9.1s-4.2 8.6-10.8 8.6H18"
                fill="none"
                stroke="var(--proof)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.5"
              />
              <path
                d="m31 31.5 11 11.5"
                fill="none"
                stroke="var(--yellow)"
                strokeLinecap="round"
                strokeWidth="3.5"
              />
              <circle cx="29" cy="22.5" r="3.2" fill="var(--blue)" />
              <path
                d="M8 28h4M44 28h4"
                fill="none"
                stroke="var(--yellow)"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          </span>
          <span className="brand-name">Reeti</span>
        </a>
        <div className="topbar-context">
          <span className="eyebrow">CREATOR WORKSPACE</span>
        </div>
        <a className="quiet-link" href="#continuity">
          History <span aria-hidden="true">↗</span>
        </a>
      </header>

      {message && (
        <div
          className={`toast toast-${message.tone}`}
          role={message.tone === "error" ? "alert" : "status"}
        >
          <span className="toast-mark" aria-hidden="true">
            {message.tone === "error" ? "!" : "·"}
          </span>
          {message.text}
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss message"
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="workbench" id="workbench">
        <aside className="campaign-index" aria-label="Campaigns">
          <div className="index-heading">
            <span className="section-kicker">Campaigns</span>
          </div>
          <p className="index-copy">
            One source becomes three drafts with their decisions attached.
          </p>
          <button
            type="button"
            className={source && !selectedCampaign ? "index-new active" : "index-new"}
            onClick={() => {
              setSource(null);
              setSelectedCampaignId(null);
              setSurface("proof");
            }}
          >
            <span>＋</span> New source
          </button>
          <ul className="campaign-list" aria-label="Saved campaigns">
            {(data?.campaigns ?? []).map((campaign) => (
              <li key={campaign.id}>
                <button
                  type="button"
                  aria-pressed={selectedCampaignId === campaign.id}
                  className={
                    selectedCampaignId === campaign.id ? "campaign-item active" : "campaign-item"
                  }
                  onClick={() => {
                    setSelectedCampaignId(campaign.id);
                    setSource(null);
                    setSurface("proof");
                  }}
                >
                  <span className="campaign-mark" aria-hidden="true">
                    {campaign.status === "approved"
                      ? "✓"
                      : campaign.status === "provider_blocked"
                        ? "!"
                        : "·"}
                  </span>
                  <span title={campaign.source?.title ?? "Untitled source"}>
                    <strong>{campaign.source?.title ?? "Untitled source"}</strong>
                    <small className={`campaign-status campaign-status-${campaign.status}`}>
                      {campaign.status === "approved"
                        ? "Approved"
                        : campaign.status === "needs_review"
                          ? "Review"
                          : campaign.status === "provider_blocked"
                            ? "Blocked"
                            : "Draft"}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="work-area">
          <nav className="surface-nav" aria-label="Reeti surfaces">
            <button
              type="button"
              className={surface === "proof" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("proof")}
            >
              Campaign
            </button>
            <button
              type="button"
              className={surface === "canon" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("canon")}
            >
              Creator rules
            </button>
            <button
              type="button"
              className={surface === "continuity" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("continuity")}
            >
              History
            </button>
          </nav>

          {!data ? (
            <div className="surface loading-surface" aria-busy="true">
              <div className="loading-line wide" />
              <div className="loading-line" />
              <div className="loading-block" />
            </div>
          ) : source ? (
            <section className="surface source-receipt" aria-labelledby="receipt-title">
              <div className="section-kicker">Source ready</div>
              <div className="receipt-grid">
                <div>
                  <h2 id="receipt-title">{source.title}</h2>
                  <p>
                    {source.wordCount.toLocaleString()} words · {source.contentHash.slice(0, 16)}… ·{" "}
                    {source.inputType === "url" ? "public URL" : "pasted text"}
                  </p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() => void buildCampaign()}
                >
                  {busy ? "Building…" : "Build campaign"}
                </button>
              </div>
              <div className="receipt-note">
                <span className="mark blue">●</span> The receipt exists before any Mind call.
                Generation will fail closed if Minds is not configured.
              </div>
            </section>
          ) : surface === "proof" ? (
            <>
              {!selectedCampaign && (
                <SourceDesk
                  busy={busy}
                  onSourceReady={(nextSource) => setSource(nextSource)}
                  onMessage={showMessage}
                />
              )}
              <CampaignProof
                campaign={selectedCampaign}
                busy={busy}
                onRefresh={refresh}
                onMessage={showMessage}
                onRetry={buildCampaign}
              />
            </>
          ) : surface === "canon" ? (
            <CanonSurface data={data} onConfirm={confirmPolicy} />
          ) : (
            <div id="continuity">
              <ContinuityRecord audit={data.audit} />
            </div>
          )}
        </section>

        <MemoryMargin campaign={selectedCampaign} policies={data?.policies ?? []} />
      </div>

      <footer className="app-footer">
        <span>Reeti / creator workspace</span>
        <span>Built for Creative Minds Jam · Content Repurposing Across Platforms</span>
        <span>Provider, deployment, and submission states stay separate.</span>
      </footer>
    </main>
  );
}

function CanonSurface({
  data,
  onConfirm,
}: {
  data: DashboardData;
  onConfirm: (policyId: string) => Promise<void>;
}) {
  const active = data.policies.filter((policy) => policy.status === "active");
  const proposed = data.policies.filter((policy) => policy.status === "proposed");
  return (
    <section className="surface canon-surface" id="creator-rules" aria-labelledby="canon-title">
      <div className="section-kicker">Creator rules</div>
      <div className="section-heading-row">
        <div>
          <h2 id="canon-title">Rules you chose to keep.</h2>
          <p className="lede">
            A creator correction becomes a durable policy only after explicit confirmation.
          </p>
        </div>
        <span className="proof-stamp">LOCAL RULES</span>
      </div>
      <div className="canon-grid">
        <PolicyGroup title="Active policies" items={active} tone="blue" />
        <PolicyGroup
          title="Proposed policies"
          items={proposed}
          tone="yellow"
          onConfirm={onConfirm}
        />
      </div>
      <div className="canon-boundary">
        <span className="mark red">×</span>
        <div>
          <strong>Authority boundary</strong>
          <p>
            Minds supplies contextual continuity. This local policy store supplies confirmed, scoped
            rules and their provenance. A proposed rule cannot govern output until you confirm it.
          </p>
        </div>
      </div>
    </section>
  );
}

function PolicyGroup({
  title,
  items,
  tone,
  onConfirm,
}: {
  title: string;
  items: DashboardData["policies"];
  tone: "blue" | "yellow";
  onConfirm?: (policyId: string) => Promise<void>;
}) {
  return (
    <div className="policy-group">
      <div className="margin-label">
        <span className={`mark ${tone}`}>{tone === "blue" ? "●" : "◆"}</span>
        {title}
        <span className="count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="quiet">Nothing recorded yet.</p>
      ) : (
        items.map((policy) => (
          <div className="policy-card" key={policy.id}>
            <div>
              <strong>{policy.rule}</strong>
              <span>Scope: {policy.scope.replaceAll("_", " ")}</span>
              <span>
                {policy.confirmedAt
                  ? `Confirmed ${new Date(policy.confirmedAt).toLocaleDateString()}`
                  : "Awaiting creator confirmation"}
              </span>
            </div>
            {onConfirm && (
              <button
                className="button small"
                type="button"
                onClick={() => void onConfirm(policy.id)}
              >
                Confirm
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
