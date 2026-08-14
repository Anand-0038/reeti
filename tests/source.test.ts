import assert from "node:assert/strict";
import { test } from "node:test";

import { validatePastedSource } from "@/lib/source";

test("pasted source requires a useful minimum body", () => {
  assert.throws(() => validatePastedSource({ body: "too short" }), /at least 40 characters/i);
});

test("pasted source preserves title and word count", () => {
  const result = validatePastedSource({
    title: "A real source",
    body: "A creator needs a clear source with enough words to review and repurpose across platforms.",
  });
  assert.equal(result.title, "A real source");
  assert.equal(result.wordCount, 15);
});
