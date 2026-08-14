import type { LedgerEntry, PolicyRecord } from "@/lib/types";

interface MemoryMarginProps {
  policies: PolicyRecord[];
  ledger: LedgerEntry[];
  onConfirm: (policyId: string) => Promise<void>;
}

export default function MemoryMargin({ policies, ledger, onConfirm }: MemoryMarginProps) {
  const activePolicies = policies.filter((policy) => policy.status === "active");
  const proposedPolicies = policies.filter((policy) => policy.status === "proposed");
  const visibleLedger = ledger.slice(0, 5);

  return (
    <aside className="memory-margin" aria-labelledby="memory-margin-title">
      <div className="section-kicker">margin / context</div>
      <h2 id="memory-margin-title">Memory Margin</h2>
      <p className="margin-intro">A working rule is only permanent when the creator confirms it.</p>

      <div className="margin-group">
        <div className="margin-label">
          <span className="mark blue">●</span> Active rules{" "}
          <span className="count">{activePolicies.length}</span>
        </div>
        {activePolicies.length === 0 ? (
          <p className="quiet">No confirmed rules yet.</p>
        ) : (
          activePolicies.map((policy) => (
            <div className="annotation active-note" key={policy.id}>
              <strong>{policy.rule}</strong>
              <span>Confirmed · {policy.scope.replaceAll("_", " ")}</span>
            </div>
          ))
        )}
      </div>

      <div className="margin-group">
        <div className="margin-label">
          <span className="mark yellow">◆</span> Needs confirmation{" "}
          <span className="count">{proposedPolicies.length}</span>
        </div>
        {proposedPolicies.length === 0 ? (
          <p className="quiet">Edits stay draft-specific until a rule is confirmed.</p>
        ) : (
          proposedPolicies.map((policy) => (
            <div className="annotation proposed-note" key={policy.id}>
              <strong>{policy.rule}</strong>
              <span>Proposed · {policy.scope.replaceAll("_", " ")}</span>
              <button
                type="button"
                className="text-button"
                onClick={() => void onConfirm(policy.id)}
              >
                Confirm rule
              </button>
            </div>
          ))
        )}
      </div>

      <div className="margin-group">
        <div className="margin-label">
          <span className="mark red">×</span> Content Ledger{" "}
          <span className="count">{ledger.length}</span>
        </div>
        {visibleLedger.length === 0 ? (
          <p className="quiet">No prior angles recorded.</p>
        ) : (
          visibleLedger.map((entry) => (
            <div className="annotation ledger-note" key={entry.id}>
              <strong>{entry.angle}</strong>
              <span>
                {entry.decision} ·{" "}
                {entry.platform === "short_video" ? "short video" : entry.platform}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="margin-footnote">
        <span className="registration-cross">＋</span> Contextual continuity comes from Minds.
        Confirmed policy and provenance stay local and inspectable.
      </div>
    </aside>
  );
}
