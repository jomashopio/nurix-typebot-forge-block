import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  syncToTypebot,
  verifyTypebotSync,
} from "../scripts/sync-to-typebot.mjs";

test("synchronizes a Typebot checkout idempotently and fails on changed anchors", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "nurix-forge-sync-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await createTypebotFixture(directory);

  await syncToTypebot(directory);
  const firstPackageJson = await readFile(
    path.join(directory, "packages/forge/repository/package.json"),
    "utf8",
  );
  await syncToTypebot(directory);
  await verifyTypebotSync(directory);
  const synchronizedActionPath = path.join(
    directory,
    "packages/forge/blocks/nurixChat/src/actions/sendMessage.ts",
  );
  const synchronizedAction = await readFile(synchronizedActionPath, "utf8");
  assert.match(synchronizedAction, /"Conversation state"/);
  assert.equal(
    await readFile(
      path.join(directory, "packages/forge/repository/package.json"),
      "utf8",
    ),
    firstPackageJson,
  );
  assert.match(firstPackageJson, /@typebot\.io\/nurix-chat-block/);

  await writeFile(
    synchronizedActionPath,
    synchronizedAction.replace('"Conversation state"', '"Conversation status"'),
  );
  await assert.rejects(verifyTypebotSync(directory), /does not match/);
  await syncToTypebot(directory);

  await writeFile(
    path.join(directory, "packages/forge/repository/src/constants.ts"),
    'export const forgedBlockIds = ["changed-upstream-anchor"];\n',
  );
  await assert.rejects(syncToTypebot(directory), /Upstream anchor changed/);
});

const createTypebotFixture = async (directory) => {
  const files = new Map([
    ["package.json", '{"name":"@typebot.io/root"}\n'],
    [
      "packages/forge/repository/package.json",
      '{\n  "dependencies": {\n    "@typebot.io/chat-node-block": "workspace:*",\n    "next": "workspace:*"\n  }\n}\n',
    ],
    [
      "packages/forge/repository/src/constants.ts",
      'export const ids = [\n  "chat-node",\n];\n',
    ],
    [
      "packages/forge/repository/src/credentials.ts",
      'import { chatNodeCredentialsSchema } from "@typebot.io/chat-node-block/schemas";\nexport const schemas = {\n  [chatNodeBlock.id]: chatNodeCredentialsSchema,\n};\n',
    ],
    [
      "packages/forge/repository/src/definitions.ts",
      'import { chatNodeBlock } from "@typebot.io/chat-node-block";\nexport const blocks = {\n  [chatNodeBlock.id]: chatNodeBlock,\n};\n',
    ],
    [
      "packages/forge/repository/src/handlers.ts",
      'import chatNodeBlockHandlers from "@typebot.io/chat-node-block/handlers";\nexport const handlers = {\n  [chatNodeBlock.id]: chatNodeBlockHandlers,\n};\n',
    ],
    [
      "packages/forge/repository/src/schemas.ts",
      'import { chatNodeBlockSchema } from "@typebot.io/chat-node-block/schemas";\nexport const schemas = {\n  [chatNodeBlock.id]: chatNodeBlockSchema,\n};\nexport const union = [\n  chatNodeBlockSchema,\n];\n',
    ],
    [
      "apps/workflows/Dockerfile.dockerignore",
      "!packages/forge/blocks/chatNode\n!packages/forge/blocks/chatNode/**\n",
    ],
  ]);

  for (const [relativePath, content] of files) {
    const filePath = path.join(directory, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
};
