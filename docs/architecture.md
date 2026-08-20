# Reeti architecture

```mermaid
flowchart LR
  creator[Creator-owned source] --> desk[Source Desk]
  desk --> importer[HTTP(S) importer or paste validator]
  importer --> sqlite[(Local SQLite\nworkflow + evidence state)]
  sqlite --> context[Confirmed policies\ncontent ledger\nprovenance]
  sqlite --> packet[Campaign evidence packet\nsafe identifiers + audit]
  context --> minds[Official Minds client\nstable conversation alias]
  source[Source text] --> minds
  minds --> parser[Strict structured response parser]
  parser --> proof[Workbench outputs\nX / LinkedIn / short-video hooks]
  proof --> feedback[Creator feedback\napprove / reject / revise]
  feedback --> sqlite
  sqlite --> canon[Creator rules\nactive vs proposed rules]
  sqlite --> worker[Due follow-up worker]
  worker --> minds
  worker --> telegram[Telegram Bot API\nprivate delivery only]
  telegram --> audit[History\nprovider IDs + failures]
  minds --> audit
  importer --> audit
```

## Trust boundaries

- Browser code never receives `MINDS_BUILDER_API_KEY`, `MINDS_MIND_ID`, Telegram credentials, or
  worker secrets.
- Source text is creator-owned data and is treated as untrusted input; URL redirects are
  revalidated and private-network targets are rejected.
- Minds owns contextual conversation continuity. SQLite owns confirmed policies, permissions,
  provenance, campaign state, idempotency, and delivery receipts.
- Each successful generation audit keeps the exact remembered rules, avoided angles, and any
  provider-returned memory effects. The Workbench renders those records beside the three drafts;
  older provider responses without effect notes are labeled as Reeti-observed effects.
- A local record cannot prove a provider result. Provider fingerprints and Telegram message IDs
  are stored only when returned by the provider.
- Follow-up text crosses a validation boundary before Telegram delivery: harmless paragraph markup
  is normalized, while internal/meta leakage, unsupported markup, and oversized replies fail closed.
- The campaign evidence packet is a local, campaign-scoped export. It includes safe identifiers,
  generated artifacts, decisions, follow-ups, and audit events, but deliberately excludes the raw
  source body.
- No public social publishing is connected. Approval means approved in the local workspace.
