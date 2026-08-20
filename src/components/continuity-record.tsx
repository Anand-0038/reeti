import type { AuditEvent } from "@/lib/types";

interface ContinuityRecordProps {
  audit: AuditEvent[];
}

function labelForType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function labelForActor(actor: AuditEvent["actor"]): string {
  return actor === "minds" ? "Minds" : actor.charAt(0).toUpperCase() + actor.slice(1);
}

export default function ContinuityRecord({ audit }: ContinuityRecordProps) {
  return (
    <section className="surface continuity-record" aria-labelledby="continuity-title">
      <div className="section-kicker">History</div>
      <div className="section-heading-row">
        <div>
          <h2 id="continuity-title">What changed, when.</h2>
          <p className="lede">
            Reeti keeps the source, decisions, provider responses, and delivery record together.
          </p>
        </div>
        <span className="proof-stamp quiet-stamp">AUDIT TRAIL</span>
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
                  <span>{labelForActor(event.actor)}</span>
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
  if (typeof detail.code === "string")
    return "The failed attempt stays visible in the local record.";
  if (typeof detail.sourceId === "string")
    return "A source receipt was created before any generation call.";
  if (typeof detail.messageId === "string")
    return `Telegram delivery confirmed · ID ${detail.messageId}`;
  if (typeof detail.manualTrigger === "boolean") {
    return detail.manualTrigger
      ? "A follow-up was run manually."
      : "A follow-up was run by the scheduled worker.";
  }
  if (typeof detail.artifactCount === "number")
    return `${detail.artifactCount} adaptations ready for review.`;
  return "State recorded in the local audit log.";
}
