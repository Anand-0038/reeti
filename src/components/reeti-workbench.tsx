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

interface MindsPreflight {
  mindId: string;
  mindName: string;
  alias: string;
  enabled: boolean;
}

export default function ReetiWorkbench() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<SourceRecord | null>(null);
  const [surface, setSurface] = useState<Surface>("proof");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [mindsPreflight, setMindsPreflight] = useState<MindsPreflight | null>(null);
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
    setSelectedCampaignId((current) => current ?? payload.campaigns[0]?.id ?? null);
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
        showMessage("Campaign generated. Review the proof sheet.", "success");
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
        showMessage("Rule confirmed in the local Creator Canon.", "success");
      } catch (error) {
        showMessage(
          error instanceof Error ? error.message : "The policy could not be confirmed.",
          "error",
        );
      }
    });
  }

  async function checkMinds() {
    setPreflightBusy(true);
    try {
      const response = await fetch("/api/minds/preflight", { method: "POST" });
      const payload = (await response.json()) as ApiError & { preflight?: MindsPreflight };
      if (!response.ok || !payload.preflight) {
        setMindsPreflight(null);
        const missing = payload.error?.details?.missing;
        const missingText = Array.isArray(missing) ? ` Missing: ${missing.join(", ")}.` : "";
        throw new Error(`${payload.error?.message ?? "Minds preflight failed."}${missingText}`);
      }
      setMindsPreflight(payload.preflight);
      showMessage(`Minds preflight passed · ${payload.preflight.mindName}`, "success");
    } catch (error) {
      setMindsPreflight(null);
      showMessage(error instanceof Error ? error.message : "Minds preflight failed.", "error");
    } finally {
      setPreflightBusy(false);
    }
  }

  const providerLabel = mindsPreflight
    ? `Minds ready · ${mindsPreflight.mindName}`
    : data?.provider.mindsConfigured
      ? "Minds credentials set"
      : "Minds needs setup";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workbench" aria-label="Reeti home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>Reeti</span>
        </a>
        <div className="topbar-context">
          <span className="eyebrow">CONTENT OPERATIONS / LOCAL</span>
          <div className="provider-context">
            <span
              className={
                mindsPreflight || data?.provider.mindsConfigured
                  ? "connection-pill good"
                  : "connection-pill warning"
              }
            >
              <span className="connection-dot" />
              {providerLabel}
            </span>
            <button
              type="button"
              className="provider-check"
              onClick={() => void checkMinds()}
              disabled={preflightBusy}
            >
              {preflightBusy ? "Checking…" : "Check Minds"}
            </button>
          </div>
        </div>
        <a className="quiet-link" href="#continuity">
          Continuity record <span aria-hidden="true">↗</span>
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
        <aside className="campaign-index" aria-label="Campaign index">
          <div className="index-heading">
            <span className="section-kicker">index</span>
            <span className="index-count">{data?.campaigns.length ?? 0}</span>
          </div>
          <p className="index-copy">One source at a time. Every draft carries its decisions.</p>
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
                  <span>
                    <strong>{campaign.source?.title ?? "Untitled source"}</strong>
                    <small>{campaign.status.replaceAll("_", " ")}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="index-footer">
            <span className="registration-cross">＋</span>
            <p>Reeti keeps the working context local. No public publishing is connected.</p>
          </div>
        </aside>

        <section className="work-area">
          <nav className="surface-nav" aria-label="Reeti surfaces">
            <button
              type="button"
              className={surface === "proof" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("proof")}
            >
              <span>02</span>Campaign Proof
            </button>
            <button
              type="button"
              className={surface === "canon" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("canon")}
            >
              <span>03</span>Creator Canon
            </button>
            <button
              type="button"
              className={surface === "continuity" ? "surface-tab active" : "surface-tab"}
              onClick={() => setSurface("continuity")}
            >
              <span>04</span>Continuity Record
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
              <div className="section-kicker">source receipt / ready</div>
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

        <MemoryMargin
          policies={data?.policies ?? []}
          ledger={data?.ledger ?? []}
          onConfirm={confirmPolicy}
        />
      </div>

      <footer className="app-footer">
        <span>Reeti / local-first proofroom</span>
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
    <section className="surface canon-surface" aria-labelledby="canon-title">
      <div className="section-kicker">03 / creator canon</div>
      <div className="section-heading-row">
        <div>
          <h2 id="canon-title">The rules behind the work.</h2>
          <p className="lede">
            A creator correction becomes a durable policy only after explicit confirmation.
          </p>
        </div>
        <span className="proof-stamp">LOCAL POLICY STORE</span>
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
