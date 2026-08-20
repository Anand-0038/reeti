import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { createMindsClient } from "@animocabrands/minds-client-lib";

import { inspectPersistenceReply, persistenceProofPassed } from "@/lib/proof";

const projectRoot = process.cwd();
const scriptPath = fileURLToPath(import.meta.url);
const dotEnvPath = join(projectRoot, ".env");

loadDotEnv(dotEnvPath);

const alias = process.env.MINDS_CONVERSATION_ALIAS?.trim() || "reeti-proof";
const mindId = process.env.MINDS_MIND_ID?.trim();
const builderApiKey = process.env.MINDS_BUILDER_API_KEY?.trim();
const artifactPath =
  process.env.REETI_PROOF_ARTIFACT ||
  join(projectRoot, "..", "hack", "evidence", "receipts", "minds_persistence_proof.json");

if (!builderApiKey || !mindId) {
  console.error(
    JSON.stringify(
      {
        status: "blocked",
        code: "MINDS_NOT_CONFIGURED",
        missing: [
          !builderApiKey ? "MINDS_BUILDER_API_KEY" : null,
          !mindId ? "MINDS_MIND_ID" : null,
        ].filter(Boolean),
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
} else if (!process.env.REETI_PROOF_SESSION) {
  const baseEnv = { ...process.env };
  const sessionA = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    env: { ...baseEnv, REETI_PROOF_SESSION: "A" },
    encoding: "utf8",
  });
  const sessionB = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    env: { ...baseEnv, REETI_PROOF_SESSION: "B" },
    encoding: "utf8",
  });
  const sessionAResult = parseSessionOutput(sessionA.stdout || sessionA.stderr);
  const sessionBResult = parseSessionOutput(sessionB.stdout || sessionB.stderr);
  const success = persistenceProofPassed({
    statusA: sessionA.status,
    statusB: sessionB.status,
    sessionA: sessionAResult,
    sessionB: sessionBResult,
  });
  const output = {
    status: success ? "passed" : "blocked",
    checkedAt: new Date().toISOString(),
    boundary: "live_minds_provider",
    alias,
    sessions: {
      A: redactSessionOutput(sessionA.stdout || sessionA.stderr),
      B: redactSessionOutput(sessionB.stdout || sessionB.stderr),
    },
    note: success
      ? "Session B ran in a separate process and returned at least two independent preference signals without Reeti local storage injection."
      : "The isolated processes did not produce a validated A/B persistence result; no persistence claim is valid.",
  };
  if (success) {
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ status: output.status, artifact: artifactPath, alias }, null, 2));
  } else {
    console.error(JSON.stringify(output, null, 2));
    process.exitCode = 2;
  }
} else {
  const client = createMindsClient({ builderApiKey });
  const minds = await client.listMinds();
  const mind = minds.find((candidate) => candidate.mindId === mindId);
  if (!mind) throw new Error("MINDS_MIND_ID was not found on the Builder account.");
  await client.ensureConversation(alias, mindId);
  const message =
    process.env.REETI_PROOF_SESSION === "A"
      ? "I am a technical creator. For future public content, do not use emojis, artificial urgency, or vague hype. Prefer technical specificity. Acknowledge this as a working preference."
      : "New source: a short explanation of why reliable evaluation matters when shipping a retrieval system. Draft one concise opening and state which creator working preferences you applied from our earlier conversation. Do not repeat my earlier instructions; recall them if they are available in your persistent context.";
  const before = await client.getLatestHistoryFingerprint(alias);
  await client.sendMessage({ alias, messageText: message });
  const outcome = await client.waitForReply({
    alias,
    timeoutMs: 180_000,
    afterFingerprint: before,
    sentMessageText: message,
  });
  if (outcome.timedOut || !outcome.reply?.messageText)
    throw new Error(`Session ${process.env.REETI_PROOF_SESSION} did not receive a Mind reply.`);
  const reply = outcome.reply.messageText;
  const { rememberedSignal, rememberedTerms } = inspectPersistenceReply(reply);
  console.log(
    JSON.stringify(
      {
        session: process.env.REETI_PROOF_SESSION,
        mindId,
        mindName: mind.name,
        enabled: mind.isEnabled,
        fingerprint: outcome.reply.fingerprint?.slice(0, 24) ?? null,
        responseHash: createHash("sha256").update(reply).digest("hex"),
        rememberedSignal,
        rememberedTerms,
      },
      null,
      2,
    ),
  );
}

function parseSessionOutput(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.session !== "string" && process.env.REETI_PROOF_SESSION) {
      parsed.session = process.env.REETI_PROOF_SESSION;
    }
    return parsed;
  } catch {
    return null;
  }
}

function redactSessionOutput(value: string): Record<string, unknown> {
  const parsed = parseSessionOutput(value);
  if (parsed) return parsed;

  const replyAnalysis = inspectPersistenceReply(value);
  return {
    session: process.env.REETI_PROOF_SESSION,
    outputHash: createHash("sha256").update(value).digest("hex"),
    exit: "non_json",
    ...replyAnalysis,
  };
}

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");

  raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const parsed = /^([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/.exec(line);
      if (!parsed) return;

      const key = parsed[1];
      let value = parsed[2] ?? "";
      if (!Object.hasOwn(process.env, key)) {
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
}
