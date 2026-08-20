import type { CampaignRecord, PolicyRecord } from "@/lib/types";

interface MemoryMarginProps {
  campaign: CampaignRecord | null;
  policies: PolicyRecord[];
}

export default function MemoryMargin({ campaign, policies }: MemoryMarginProps) {
  const context = campaign?.generationContext;
  const activePolicyCount = policies.filter((policy) => policy.status === "active").length;
  const memoryCount = context ? context.rememberedRules.length : 0;
  const avoidedCount = context ? context.avoidedAngles.length : 0;

  return (
    <aside className="memory-margin" aria-labelledby="memory-margin-title">
      <div className="section-kicker">Context</div>
      <h2 id="memory-margin-title">For this source</h2>
      <p className="margin-intro">
        {campaign?.source?.title ?? "Select a campaign to see the context behind its drafts."}
      </p>

      {context ? (
        <>
          <div className="margin-group">
            <div className="margin-label">
              <span className="mark blue">●</span> Minds context
            </div>
            <div className="context-counts">
              <strong>{memoryCount}</strong>
              <span>memories returned with this generation</span>
            </div>
            <p className="quiet">
              {avoidedCount} prior {avoidedCount === 1 ? "angle was" : "angles were"} kept out of
              the pack.
            </p>
          </div>

          <div className="margin-group">
            <div className="margin-label">
              <span className="mark yellow">◆</span> Next decision
            </div>
            <p className="context-question">
              {context.nextReviewQuestion ??
                "Review the three adaptations and choose what to refine."}
            </p>
          </div>

          <div className="margin-group">
            <div className="margin-label">
              <span className="mark blue">●</span> Creator authority
            </div>
            <p className="quiet">
              {activePolicyCount} confirmed {activePolicyCount === 1 ? "rule" : "rules"} govern
              future review.
            </p>
            <a className="text-button context-link" href="#creator-rules">
              Review creator rules
            </a>
          </div>
        </>
      ) : (
        <div className="margin-empty">
          <span className="empty-mark" aria-hidden="true">
            →
          </span>
          <strong>No generation context yet.</strong>
          <p>Build a campaign to see which Minds memories shaped the drafts.</p>
        </div>
      )}

      <div className="margin-footnote">
        <span className="registration-cross">＋</span>
        <span>Minds supplies context. Your creator rules stay with you.</span>
      </div>
    </aside>
  );
}
