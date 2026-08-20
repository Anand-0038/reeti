# Reeti

Reeti is a continuity-first content workbench for creators who publish across
multiple channels. It turns one source into a reviewable campaign, keeps the
creator's preferences as explicit policy, records what changed, and schedules a
bounded follow-up that can be delivered through Telegram when a valid destination
is configured and verified.

The project is being built for Creative Minds Jam #1: Hong Kong. Minds is the
intended reasoning and persistent-memory layer; the local app deliberately
shows a provider-blocked state when its credentials are unavailable instead of
pretending that an AI response or delivery occurred.

## Current status

The local product flow is implemented and verified through build, lint,
typecheck, unit tests, a deterministic local SQLite workflow, and browser
interaction checks. A live Minds Builder preflight, a separate-process
persistence proof, and the in-app source → generation → feedback → policy →
second-source flow have been captured for the configured Mind.

Telegram preflight has also verified the configured bot and `/start` chat, and a
scheduled worker run delivered one private follow-up with a real Telegram
message identifier. The public checkout contains no credentials or private
provider receipts.

That boundary is intentional:

- local source import, campaign state, policy confirmation, audit history, and
  follow-up scheduling are real and persisted in SQLite; each campaign can expose
  a scoped local evidence packet that excludes the raw source body;
- Minds is the real contextual continuity layer; its provider identity,
  cross-session persistence proof, and app-level generation/feedback/policy/
  second-source flow are verified for the configured alias. Successful generation
  records also retain the exact returned memories and any provider-supplied
  memory-to-effect notes beside the three adaptations;
- Telegram delivery is verified for the configured private destination at the
  provider boundary. Re-run the guarded Telegram preflight and worker checks
  after changing the bot, destination, or worker secret;
- Follow-up replies are normalized to plain text and validated before delivery;
  internal/meta responses, unsupported markup, and oversized replies fail closed
  instead of reaching Telegram;
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

To find a Telegram destination, send `/start` to the bot and inspect the
`message.chat.id` value returned by the Bot API `getUpdates` method. For a group
or channel, add the bot to that chat first and inspect `message.chat.id` or
`channel_post.chat.id`; group and channel IDs are commonly negative. Keep the
bot token and raw API response private. See the [official Telegram Bot API
documentation](https://core.telegram.org/bots/api).

To run due local follow-ups manually:

```bash
corepack pnpm run worker
```

This is a manual trigger, not proof of a deployed scheduler. For the guarded
HTTP worker and Telegram preflight, set `REETI_WORKER_SECRET` to a long random
value and send it in the `x-reeti-worker-secret` header. The scheduled worker
only claims autonomous follow-up when it runs with `manualTrigger=false`, and
it only claims Telegram delivery after the real Bot API returns a message
identifier. The preflight route returns only bot identity and redacted update
evidence; it never returns the token or raw chat messages.

```bash
curl -X POST http://127.0.0.1:3000/api/telegram/preflight \
  -H "x-reeti-worker-secret: $REETI_WORKER_SECRET"
```

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

The intended demo is a focused 1.5–2 minute proof:

1. show the creator problem and paste one source;
2. keep the three actual adaptations visible at the center of the Workbench;
3. show the exact Minds memories and their rule cause → effect;
4. confirm a creator rule, record feedback, and schedule a follow-up;
5. show live Minds persistence and the private Telegram delivery receipt from
   the real services; keep the provider, local, public, and submission
   boundaries visible.

The draft script is in [`docs/demo-script.md`](docs/demo-script.md). It should
be updated with provider IDs, screenshots, and timestamps only after those
receipts exist. The private blocked-path capture runbook remains in the event
control room and is not part of the public project repository.
