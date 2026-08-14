import assert from "node:assert/strict";
import { test } from "node:test";

import { parseGeneratedCampaign } from "@/lib/content";

test("structured Mind response parses fenced JSON safely", () => {
  const result = parseGeneratedCampaign(
    `Here is the pack:\n\`\`\`json\n${JSON.stringify({ summary: "Specific summary", xThread: ["One", "Two", "Three"], linkedin: "A post", shortHooks: ["A", "B", "C"], rememberedRules: ["No hype"], avoidedAngles: ["Old angle"], nextReviewQuestion: "Approve?" })}\n\`\`\``,
  );
  assert.equal(result.xThread.length, 3);
  assert.equal(result.shortHooks.length, 3);
});

test("malformed Mind response fails closed", () => {
  assert.throws(() => parseGeneratedCampaign("not json"), /valid JSON|JSON object/i);
});
