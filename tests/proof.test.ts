import { strict as assert } from "node:assert";
import test from "node:test";

import { inspectPersistenceReply, persistenceProofPassed } from "@/lib/proof";

test("persistence reply needs multiple independent preference signals", () => {
  assert.deepEqual(inspectPersistenceReply("No emojis or artificial urgency; keep it technical."), {
    rememberedTerms: ["emoji", "urgency", "technical"],
    rememberedSignal: true,
  });
  assert.deepEqual(inspectPersistenceReply("I applied one preference."), {
    rememberedTerms: [],
    rememberedSignal: false,
  });
});

test("persistence proof rejects successful processes without recalled context", () => {
  const base = {
    statusA: 0,
    statusB: 0,
    sessionA: { session: "A", rememberedSignal: false },
  };
  assert.equal(
    persistenceProofPassed({
      ...base,
      sessionB: { session: "B", rememberedSignal: false },
    }),
    false,
  );
  assert.equal(
    persistenceProofPassed({
      ...base,
      sessionB: { session: "B", rememberedSignal: true },
    }),
    true,
  );
});
