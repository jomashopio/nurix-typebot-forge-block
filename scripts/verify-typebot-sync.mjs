import path from "node:path";
import process from "node:process";
import { verifyTypebotSync } from "./sync-to-typebot.mjs";

const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: node scripts/verify-typebot-sync.mjs <typebot-checkout>",
  );
await verifyTypebotSync(path.resolve(destination));
console.log(
  "The Typebot checkout matches the canonical Nurix Forge block source.",
);
