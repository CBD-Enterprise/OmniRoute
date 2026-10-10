import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("cached keys honor expiry and reject malformed timestamps", async () => {
  const dir = mkdtempSync(join(tmpdir(), "omniroute-key-expiry-"));
  process.env.API_KEY_SECRET = "isolated-expiry-test-secret";
  process.env.DATA_DIR = dir;
  process.env.SQLITE_FILE = join(dir, "storage.sqlite");
  const { createApiKey, validateApiKey } = await import("../../../src/lib/db/apiKeys.ts");
  const { resetDbInstance } = await import("../../../src/lib/db/core.ts");
  const realNow = Date.now;
  try {
    const now = realNow();
    const key = await createApiKey("expiry test", "test", [], {
      expiresAt: new Date(now + 10000).toISOString(),
    });
    assert.equal(await validateApiKey(key.key), true);
    Date.now = () => now + 10000;
    assert.equal(await validateApiKey(key.key), false);
    Date.now = realNow;
    const malformed = await createApiKey("malformed expiry", "test", [], {
      expiresAt: "not-a-date",
    });
    assert.equal(await validateApiKey(malformed.key), false);
    const permanent = await createApiKey("no expiry", "test");
    assert.equal(await validateApiKey(permanent.key), true);
  } finally {
    Date.now = realNow;
    resetDbInstance();
    rmSync(dir, { recursive: true, force: true });
  }
});
