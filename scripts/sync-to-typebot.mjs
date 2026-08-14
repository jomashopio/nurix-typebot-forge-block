import { cp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceBlockDirectory = path.join(
  repositoryRoot,
  "packages",
  "forge",
  "blocks",
  "nurixChat",
);
const destinationBlockPath = "packages/forge/blocks/nurixChat";

const registrationPlans = [
  {
    path: "packages/forge/repository/package.json",
    marker: '"@typebot.io/nurix-chat-block": "workspace:*"',
    anchor: '    "@typebot.io/chat-node-block": "workspace:*",',
    insertion: '\n    "@typebot.io/nurix-chat-block": "workspace:*",',
  },
  {
    path: "packages/forge/repository/src/constants.ts",
    marker: '  "nurix-chat",',
    anchor: '  "chat-node",',
    insertion: '\n  "nurix-chat",',
  },
  {
    path: "packages/forge/repository/src/credentials.ts",
    marker: 'import { nurixChatBlock } from "@typebot.io/nurix-chat-block";',
    anchor:
      'import { chatNodeCredentialsSchema } from "@typebot.io/chat-node-block/schemas";',
    insertion:
      '\nimport { nurixChatBlock } from "@typebot.io/nurix-chat-block";\nimport { nurixChatCredentialsSchema } from "@typebot.io/nurix-chat-block/schemas";',
  },
  {
    path: "packages/forge/repository/src/credentials.ts",
    marker: "  [nurixChatBlock.id]: nurixChatCredentialsSchema,",
    anchor: "  [chatNodeBlock.id]: chatNodeCredentialsSchema,",
    insertion: "\n  [nurixChatBlock.id]: nurixChatCredentialsSchema,",
  },
  {
    path: "packages/forge/repository/src/definitions.ts",
    marker: 'import { nurixChatBlock } from "@typebot.io/nurix-chat-block";',
    anchor: 'import { chatNodeBlock } from "@typebot.io/chat-node-block";',
    insertion:
      '\nimport { nurixChatBlock } from "@typebot.io/nurix-chat-block";',
  },
  {
    path: "packages/forge/repository/src/definitions.ts",
    marker: "  [nurixChatBlock.id]: nurixChatBlock,",
    anchor: "  [chatNodeBlock.id]: chatNodeBlock,",
    insertion: "\n  [nurixChatBlock.id]: nurixChatBlock,",
  },
  {
    path: "packages/forge/repository/src/handlers.ts",
    marker: 'import { nurixChatBlock } from "@typebot.io/nurix-chat-block";',
    anchor:
      'import chatNodeBlockHandlers from "@typebot.io/chat-node-block/handlers";',
    insertion:
      '\nimport { nurixChatBlock } from "@typebot.io/nurix-chat-block";\nimport nurixChatBlockHandlers from "@typebot.io/nurix-chat-block/handlers";',
  },
  {
    path: "packages/forge/repository/src/handlers.ts",
    marker: "  [nurixChatBlock.id]: nurixChatBlockHandlers,",
    anchor: "  [chatNodeBlock.id]: chatNodeBlockHandlers,",
    insertion: "\n  [nurixChatBlock.id]: nurixChatBlockHandlers,",
  },
  {
    path: "packages/forge/repository/src/schemas.ts",
    marker: 'import { nurixChatBlock } from "@typebot.io/nurix-chat-block";',
    anchor:
      'import { chatNodeBlockSchema } from "@typebot.io/chat-node-block/schemas";',
    insertion:
      '\nimport { nurixChatBlock } from "@typebot.io/nurix-chat-block";\nimport { nurixChatBlockSchema } from "@typebot.io/nurix-chat-block/schemas";',
  },
  {
    path: "packages/forge/repository/src/schemas.ts",
    marker: "  [nurixChatBlock.id]: nurixChatBlockSchema,",
    anchor: "  [chatNodeBlock.id]: chatNodeBlockSchema,",
    insertion: "\n  [nurixChatBlock.id]: nurixChatBlockSchema,",
  },
  {
    path: "packages/forge/repository/src/schemas.ts",
    marker: "  nurixChatBlockSchema,",
    anchor: "  chatNodeBlockSchema,",
    insertion: "\n  nurixChatBlockSchema,",
  },
  {
    path: "apps/workflows/Dockerfile.dockerignore",
    marker: "!packages/forge/blocks/nurixChat/**",
    anchor: "!packages/forge/blocks/chatNode/**",
    insertion:
      "\n!packages/forge/blocks/nurixChat\n!packages/forge/blocks/nurixChat/**",
  },
];

export const syncToTypebot = async (typebotRoot) => {
  await validateTypebotRoot(typebotRoot);
  const updates = await prepareRegistrationUpdates(typebotRoot);
  const destination = path.join(typebotRoot, destinationBlockPath);
  await rm(destination, { recursive: true, force: true });
  await cp(sourceBlockDirectory, destination, { recursive: true });
  for (const update of updates) await writeFile(update.path, update.content);
};

export const verifyTypebotSync = async (typebotRoot) => {
  await validateTypebotRoot(typebotRoot);
  const updates = await prepareRegistrationUpdates(typebotRoot);
  if (updates.length > 0)
    throw new Error("Typebot registration files are not synchronized.");
  if (
    !(await directoriesMatch(
      sourceBlockDirectory,
      path.join(typebotRoot, destinationBlockPath),
    ))
  )
    throw new Error(
      "The Typebot Nurix block directory does not match the canonical source.",
    );
};

const prepareRegistrationUpdates = async (typebotRoot) => {
  const contentByPath = new Map();

  for (const plan of registrationPlans) {
    const filePath = path.join(typebotRoot, plan.path);
    const currentContent =
      contentByPath.get(filePath) ?? (await readFile(filePath, "utf8"));
    if (currentContent.includes(plan.marker)) {
      contentByPath.set(filePath, currentContent);
      continue;
    }

    if (countOccurrences(currentContent, plan.anchor) !== 1)
      throw new Error(`Upstream anchor changed: ${plan.path}`);
    contentByPath.set(
      filePath,
      currentContent.replace(plan.anchor, plan.anchor + plan.insertion),
    );
  }

  const updates = [];
  for (const [filePath, content] of contentByPath) {
    if ((await readFile(filePath, "utf8")) !== content)
      updates.push({ path: filePath, content });
  }
  return updates;
};

const validateTypebotRoot = async (typebotRoot) => {
  const packageJsonPath = path.join(typebotRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (packageJson.name !== "@typebot.io/root")
    throw new Error("The destination is not a Typebot repository root.");
};

const directoriesMatch = async (left, right) => {
  try {
    if (!(await stat(right)).isDirectory()) return false;
  } catch {
    return false;
  }

  const leftEntries = (await readdir(left, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  const rightEntries = (await readdir(right, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  if (leftEntries.length !== rightEntries.length) return false;

  for (let index = 0; index < leftEntries.length; index += 1) {
    const leftEntry = leftEntries[index];
    const rightEntry = rightEntries[index];
    if (!leftEntry || !rightEntry || leftEntry.name !== rightEntry.name)
      return false;
    const leftPath = path.join(left, leftEntry.name);
    const rightPath = path.join(right, rightEntry.name);
    if (leftEntry.isDirectory() !== rightEntry.isDirectory()) return false;
    if (leftEntry.isDirectory()) {
      if (!(await directoriesMatch(leftPath, rightPath))) return false;
    } else if (
      !Buffer.from(await readFile(leftPath)).equals(
        Buffer.from(await readFile(rightPath)),
      )
    ) {
      return false;
    }
  }
  return true;
};

const countOccurrences = (value, search) => value.split(search).length - 1;

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2];
  if (!destination)
    throw new Error(
      "Usage: node scripts/sync-to-typebot.mjs <typebot-checkout>",
    );
  await syncToTypebot(path.resolve(destination));
  console.log(
    "Nurix Forge block synchronized. Run the Nx submission checks next.",
  );
}
