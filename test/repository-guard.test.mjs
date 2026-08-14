import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { formatFinding, scanRepository } from "../scripts/repository-guard.mjs";

test("detects a credential without printing its value", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nurix-forge-guard-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const candidate = ["Real", "Gateway", "Credential", "7890"].join("");
  await writeFile(
    path.join(directory, "fixture.json"),
    JSON.stringify({ gatewayApiKey: candidate }),
  );

  const findings = await scanRepository(directory, ["fixture.json"]);
  assert.ok(
    findings.some((finding) => finding.id === "literal-secret-assignment"),
  );
  assert.ok(
    findings.every((finding) => !formatFinding(finding).includes(candidate)),
  );
});
