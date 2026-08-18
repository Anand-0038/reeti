# Reeti

Reeti is a continuity-first content workbench for creators who publish across
multiple channels. It turns one source into a reviewable campaign, keeps the
creator's preferences as explicit policy, records what changed, and schedules a
follow-up that can be delivered through Telegram after the real provider path is
configured.

The project is being built for Creative Minds Jam #1: Hong Kong. Minds is the
intended reasoning and persistent-memory layer; the local app deliberately
shows a provider-blocked state when its credentials are unavailable instead of
pretending that an AI response or delivery occurred.

## Current status

The local product flow is implemented and verified through build, lint,
typecheck, unit tests, and a deterministic local SQLite workflow. The live Minds
and Telegram paths are not claimed yet because this checkout currently has no
`MINDS_BUILDER_API_KEY`, `MINDS_MIND_ID`, `TELEGRAM_BOT_TOKEN`, or
`TELEGRAM_CHAT_ID` configured.

That boundary is intentional:

- local source import, campaign state, policy confirmation, audit history, and
  follow-up scheduling are real and persisted in SQLite; each campaign can expose
  a scoped local evidence packet that excludes the raw source body;
- Minds generation, cross-session persistence, and Telegram delivery require
  the corresponding real credentials and must be verified end to end;
- deployment, public URLs, repository publication, video, and final submission
  are separate release gates and are not implied by local checks.

## Run locally

Requirements: Node.js 22.5+ and pnpm 11.

```bash
corepack pnpm install
cp .env.example .env.local
corepack pnpm dev
```

Open `http://localhost:3000`. Paste a public article, transcript, or a safe
source excerpt, then build a campaign. When Minds is not configured, the UI
keeps the source receipt and creates a reviewable `provider_blocked` campaign
record with the exact missing configuration boundary.

## Real provider configuration

Set these values locally, never commit them:

```dotenv
MINDS_BUILDER_API_KEY=
MINDS_MIND_ID=
MINDS_CONVERSATION_ALIAS=reeti-main
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
REETI_WORKER_SECRET=
REETI_DB_PATH=
```

The Minds adapter uses the official `@animocabrands/minds-client-lib` client.
Run the two-process persistence proof only after the builder key and exact Mind
ID are available:

```bash
corepack pnpm run proof:minds
```

The proof must show that a preference written in one process affects a later
source task in another process. A successful client initialization alone is not
enough evidence.

To run due local follow-ups manually:

```bash
corepack pnpm run worker
```

This is a manual trigger, not proof of a deployed scheduler. The worker only
claims Telegram delivery after the real Bot API returns a message identifier.

## Verification

```bash
corepack pnpm run format:check
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm test
corepack pnpm run build
```

## Architecture

- Next.js App Router provides the workbench and server-only API routes.
- SQLite through Node's `node:sqlite` stores creators, sources, campaigns,
  artifacts, policies, ledger entries, feedback, follow-ups, and audit events.
- The source importer enforces HTTP(S), size, timeout, redirect, and private
  network checks before accepting a URL.
- Minds is isolated behind `src/lib/minds.ts`; the rest of the workflow does
  not fabricate provider output when that adapter is unavailable.
- Telegram is isolated behind `src/lib/telegram.ts` and records the provider
  message ID only after a real API response.
- Campaign-scoped evidence packets are assembled server-side from SQLite and
  label the local/provider boundary explicitly. They are not public release or
  submission receipts.

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/evidence-boundary.md`](docs/evidence-boundary.md) for the system map and
claim boundaries.

## Demo contract

The intended demo is a focused 90–150 second proof:

1. show the creator problem and paste one source;
2. show Reeti's campaign output and the explicit provider state;
3. confirm a policy, record feedback, and schedule a follow-up;
4. show the continuity/audit record;
5. show live Minds persistence and Telegram delivery only when those responses
   have been captured from the real services.

The draft script is in [`docs/demo-script.md`](docs/demo-script.md). It should
be updated with provider IDs, screenshots, and timestamps only after those
receipts exist.
