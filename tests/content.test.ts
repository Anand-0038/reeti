import assert from "node:assert/strict";
import { test } from "node:test";

import { parseGeneratedCampaign, prepareFollowupMessage } from "@/lib/content";

test("structured Mind response parses fenced JSON safely", () => {
  const result = parseGeneratedCampaign(
    `Here is the pack:\n\`\`\`json\n${JSON.stringify({ summary: "Specific summary", xThread: ["One", "Two", "Three"], linkedin: "A post", shortHooks: ["A", "B", "C"], rememberedRules: ["No hype"], avoidedAngles: ["Old angle"], memoryEffects: [{ memory: "No hype", effect: "Keeps the opening specific." }], nextReviewQuestion: "Approve?" })}\n\`\`\``,
  );
  assert.equal(result.xThread.length, 3);
  assert.equal(result.shortHooks.length, 3);
});

test("malformed Mind response fails closed", () => {
  assert.throws(() => parseGeneratedCampaign("not json"), /valid JSON|JSON object/i);
});

test("structured Mind response ignores unrelated braces before a valid object", () => {
  const result = parseGeneratedCampaign(
    `The source mentioned {a placeholder}.\n${JSON.stringify({ summary: "Specific summary", xThread: ["One", "Two", "Three"], linkedin: "A post", shortHooks: ["A", "B", "C"], rememberedRules: ["No hype"], avoidedAngles: [], memoryEffects: [{ memory: "No hype", effect: "Keeps the opening specific." }], nextReviewQuestion: "Approve?" })}`,
  );
  assert.equal(result.summary, "Specific summary");
});

test("follow-up messages become readable plain text before Telegram delivery", () => {
  assert.equal(
    prepareFollowupMessage(
      "<p>Choose the working-tools angle.</p><p>Which audience should lead?</p><p>- reeti</p>",
    ),
    "Choose the working-tools angle.\n\nWhich audience should lead?",
  );
});

test("internal or repeated follow-up prose fails closed", () => {
  assert.throws(
    () =>
      prepareFollowupMessage(
        '<p>This is the same instruction verbatim.</p><p>If you want me to hold, say "hold".</p>',
      ),
    /internal follow-up instructions/i,
  );
});

test("unknown markup fails closed instead of being silently stripped", () => {
  assert.throws(() => prepareFollowupMessage("<h1>Choose one angle.</h1>"), /unsupported markup/i);
});
