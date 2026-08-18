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
          <div className="section-kicker">proof / packet</div>
          <h3 id="evidence-packet-title">One campaign, one local proof bundle.</h3>
        </div>
        <span className="boundary-label">LOCAL ONLY</span>
      </div>
      <p className="evidence-intro">
        The packet binds the source receipt, editorial decisions, follow-up state, and audit trail
        without exporting the raw source body. It is evidence of Reeti&apos;s local record, not
        proof of public, deployed, or submitted state.
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
            <EvidenceCheck label="Source receipt" value={packet.proof.sourceReceipt} tone="blue" />
            <EvidenceCheck
              label="Generation"
              value={packet.proof.generation}
              tone={packet.proof.generation === "provider_blocked" ? "red" : "blue"}
            />
            <EvidenceCheck
              label="Creator decision"
              value={packet.proof.creatorDecision}
              tone={packet.proof.creatorDecision === "recorded" ? "green" : "yellow"}
            />
            <EvidenceCheck
              label="Follow-up"
              value={packet.proof.followUp}
              tone={packet.proof.followUp === "failed" ? "red" : "blue"}
            />
          </div>
          <div className="evidence-meta">
            <span>
              {packet.audit.length} audit events · {packet.feedback.length} feedback records ·{" "}
              {packet.followups.length} follow-up records
            </span>
            <span>Source hash {packet.source.contentHash.slice(0, 12)}…</span>
          </div>
          <div className="evidence-actions">
            <span className="field-note">
              JSON includes generated artifacts and safe identifiers; raw source text is excluded.
            </span>
            <button
              type="button"
              className="button outline"
              onClick={onDownload}
              disabled={downloadBusy}
            >
              {downloadBusy ? "Preparing download…" : "Download local evidence"}
            </button>
          </div>
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
        <small>{value.replaceAll("_", " ")}</small>
      </span>
    </div>
  );
}
