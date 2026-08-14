import type { AuditEvent } from "@/lib/types";

interface ContinuityRecordProps {
  audit: AuditEvent[];
}

function labelForType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function ContinuityRecord({ audit }: ContinuityRecordProps) {
  return (
    <section className="surface continuity-record" aria-labelledby="continuity-title">
      <div className="section-kicker">04 / continuity record</div>
      <div className="section-heading-row">
        <div>
          <h2 id="continuity-title">The work has a history.</h2>
          <p className="lede">
            Every meaningful state change stays visible. Failures are not edited out by later
            retries.
          </p>
        </div>
        <span className="proof-stamp quiet-stamp">AUDIT VIEW</span>
      </div>
      {audit.length === 0 ? (
        <div className="empty-state compact">
          <span className="empty-mark">＋</span>
          <strong>No events yet</strong>
          <p>Save a source to begin the record.</p>
        </div>
      ) : (
        <ol className="timeline">
          {audit.map((event) => (
            <li key={event.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-copy">
                <div className="timeline-meta">
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span>{event.actor}</span>
                </div>
                <strong>{labelForType(event.type)}</strong>
                <p>{detailText(event)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function detailText(event: AuditEvent): string {
  const detail = event.detail;
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.code === "string") return `${detail.code} · local boundary recorded`;
  if (typeof detail.sourceId === "string")
    return "A source receipt was created before any generation call.";
  if (typeof detail.providerFingerprint === "string")
    return `Provider fingerprint ${detail.providerFingerprint}`;
  if (typeof detail.manualTrigger === "boolean")
    return `manualTrigger=${String(detail.manualTrigger)}`;
  if (typeof detail.artifactCount === "number")
    return `${detail.artifactCount} output groups recorded for review.`;
  return "State recorded in the local audit log.";
}
