# Reeti architecture

```mermaid
flowchart LR
  creator[Creator-owned source] --> desk[Source Desk]
  desk --> importer[HTTP(S) importer or paste validator]
  importer --> sqlite[(Local SQLite\nworkflow + evidence state)]
  sqlite --> context[Confirmed policies\ncontent ledger\nprovenance]
  context --> minds[Official Minds client\nstable conversation alias]
  source[Source text] --> minds
  minds --> parser[Strict structured response parser]
  parser --> proof[Campaign Proof\nX / LinkedIn / short hooks]
  proof --> feedback[Creator feedback\napprove / reject / revise]
  feedback --> sqlite
  sqlite --> canon[Creator Canon\nactive vs proposed rules]
  sqlite --> worker[Due follow-up worker]
  worker --> minds
  worker --> telegram[Telegram Bot API\nprivate delivery only]
  telegram --> audit[Continuity Record\nprovider IDs + failures]
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
- A local record cannot prove a provider result. Provider fingerprints and Telegram message IDs
  are stored only when returned by the provider.
- No public social publishing is connected. Approval means approved in the local workspace.
