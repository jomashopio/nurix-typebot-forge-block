import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const bannedExtensions = new Set([
  ".har",
  ".key",
  ".p12",
  ".pem",
  ".pfx",
  ".sqlite",
  ".webm",
  ".zip",
]);
const bannedPrefixes = ["coverage/", "dist/", "test-results/"];
const secretName =
  "NURIX_DATA_API_KEY|NURIX_GATEWAY_API_KEY|GATEWAY_SHARED_SECRET|dataApiKey|gatewayApiKey|apiKey|password|secret|token";
const namedAssignment = new RegExp(
  String.raw`["']?(?:${secretName})["']?\s*(?:=|:)\s*["']([^"']+)["']`,
  "i",
);
const rules = [
  { id: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "nurix-shaped-hex", pattern: /\b[0-9a-f]{32}\b/i },
  {
    id: "literal-bearer",
    pattern:
      /Authorization\s*[:=]\s*[`"']?Bearer\s+(?!\$\{|<|__)[A-Za-z0-9._-]{8,}/i,
  },
  {
    id: "credential-query",
    pattern: /[?&](?:api_key|token|secret)=(?!\$\{|<|__)[A-Za-z0-9._-]{8,}/i,
  },
];

export const listRepositoryFiles = (repositoryRoot) =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: repositoryRoot,
      encoding: "buffer",
    },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

export const scanRepository = async (repositoryRoot, filePaths) => {
  const findings = [];

  for (const suppliedPath of filePaths) {
    const relativePath = suppliedPath.replaceAll("\\", "/");
    const extension = path.extname(relativePath).toLowerCase();
    if (
      relativePath === ".env" ||
      (path.basename(relativePath).startsWith(".env.") &&
        relativePath !== ".env.example") ||
      bannedExtensions.has(extension) ||
      bannedPrefixes.some((prefix) => relativePath.startsWith(prefix))
    ) {
      findings.push({ id: "banned-file", path: relativePath, line: 1 });
      continue;
    }

    const filePath = path.resolve(repositoryRoot, suppliedPath);
    const fileStats = await stat(filePath);
    if (fileStats.size > 2_000_000) {
      findings.push({ id: "oversized-file", path: relativePath, line: 1 });
      continue;
    }
    const buffer = await readFile(filePath);
    if (buffer.includes(0)) {
      findings.push({ id: "binary-file", path: relativePath, line: 1 });
      continue;
    }

    buffer
      .toString("utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        const assignment = line.match(namedAssignment)?.[1];
        if (assignment && !isSafeValue(assignment))
          findings.push({
            id: "literal-secret-assignment",
            path: relativePath,
            line: index + 1,
          });
        for (const rule of rules) {
          if (rule.pattern.test(line))
            findings.push({ id: rule.id, path: relativePath, line: index + 1 });
        }
      });
  }
  return findings;
};

export const formatFinding = (finding) =>
  `${finding.id}: ${finding.path}:${finding.line}`;

const isSafeValue = (value) =>
  /^(?:__[^\s]+__|<[^\s]+>|\$\{.*\})$/i.test(value) ||
  /(?:sentinel|placeholder|test-|fake|example)/i.test(value);
