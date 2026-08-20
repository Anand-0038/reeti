import type { CampaignProofBundle } from "@/lib/types";

interface EvidencePacketProps {
  packet: CampaignProofBundle | null;
  busy: boolean;
  error: string | null;
  downloadBusy: boolean;
  onRetry: () => void;
  onDownload: () => void;
}

export default function EvidencePacket({
  packet,
  busy,
  error,
  downloadBusy,
  onRetry,
  onDownload,
}: EvidencePacketProps) {
  return (
    <section className="evidence-panel" aria-labelledby="evidence-packet-title">
      <div className="evidence-panel-heading">
        <div>
          <div className="section-kicker">Record</div>
          <h3 id="evidence-packet-title">Campaign record</h3>
        </div>
        <span className="boundary-label">REVIEW RECORD</span>
      </div>
      <p className="evidence-intro">
        Source receipt, draft status, creator decisions, and follow-up state are kept together. Raw
        source text is not included in the download.
      </p>

      {busy ? (
        <p className="evidence-status" role="status">
          Preparing the campaign packet…
        </p>
      ) : error ? (
        <div className="evidence-error" role="alert">
          <span>{error}</span>
          <button type="button" className="text-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : packet ? (
        <>
          <div className="evidence-grid">
            <EvidenceCheck label="Source" value={packet.proof.sourceReceipt} tone="blue" />
            <EvidenceCheck
              label="Drafts"
              value={packet.proof.generation}
              tone={packet.proof.generation === "provider_blocked" ? "red" : "blue"}
            />
            <EvidenceCheck
              label="Creator review"
              value={packet.proof.creatorDecision}
              tone={packet.proof.creatorDecision === "recorded" ? "green" : "yellow"}
            />
            <EvidenceCheck
              label="Follow-up"
              value={packet.proof.followUp}
              tone={packet.proof.followUp === "failed" ? "red" : "blue"}
            />
          </div>
          <details className="evidence-details">
            <summary>Evidence details</summary>
            <div className="evidence-details-body">
              <div className="evidence-meta">
                <span>
                  {packet.audit.length} history entries · {packet.feedback.length} feedback records
                  · {packet.followups.length} follow-up records
                </span>
                <span>Source hash {packet.source.contentHash.slice(0, 12)}…</span>
              </div>
              <div className="evidence-actions">
                <span className="field-note">JSON includes drafts and safe identifiers.</span>
                <button
                  type="button"
                  className="button outline"
                  onClick={onDownload}
                  disabled={downloadBusy}
                >
                  {downloadBusy ? "Preparing download…" : "Download record"}
                </button>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}

function EvidenceCheck({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "yellow" | "red";
}) {
  return (
    <div className="evidence-check">
      <span className={`evidence-check-mark ${tone}`} aria-hidden="true">
        {tone === "red" ? "!" : "✓"}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{friendlyEvidenceValue(value)}</small>
      </span>
    </div>
  );
}

function friendlyEvidenceValue(value: string): string {
  return (
    {
      artifacts_recorded: "recorded",
      provider_blocked: "blocked",
      not_run: "not run",
      recorded: "recorded",
      none: "none",
      scheduled: "scheduled",
      executed: "executed",
      failed: "failed",
      mixed: "mixed",
    }[value] ?? value.replaceAll("_", " ")
  );
}
