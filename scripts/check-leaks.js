#!/usr/bin/env node
/**
 * Wrexlyn website — pre-publish leak scanner.
 *
 * This repo's content is the public face of a private, proprietary product.
 * In August 2026, the exact NCP convergence-score formula, a real source
 * file path (src/convergence.ts), and six real internal tool names had all
 * been sitting in published docs and a downloadable deck for days before
 * anyone caught it by hand. This script exists so that class of leak gets
 * caught automatically, every time, instead of depending on someone
 * remembering to grep for it.
 *
 * Scans every text file (.html/.md/.js/.css) plus the slide text inside
 * every .pptx in assets/ for a maintained list of real internal identifiers
 * pulled directly from the coding-agent source: tool names, named
 * scoring/algorithm functions, literal source file paths, GitHub links to
 * the private repo, and license-server API routes. It deliberately does
 * NOT flag `.coding-agent/` itself — that folder name is real, accurate,
 * user-facing product documentation, not a secret (see the config-file
 * check below for the more granular internal paths that ARE flagged).
 *
 * Run via `node scripts/check-leaks.js` locally, or automatically as a
 * blocking step in .github/workflows/pages.yml before every deploy.
 *
 * PDFs are not scanned directly — every PDF this repo ships is regenerated
 * from its matching .pptx via PowerPoint, so a clean .pptx guarantees a
 * clean PDF. If that ever stops being true, this comment is the tripwire.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "screenshots"]);
const scannableExtensions = new Set([".html", ".md", ".js", ".css"]);

// Exact internal tool names (coding-agent/src/tools/*.ts) — naming these in
// marketing copy reveals the literal tool-calling interface, not just the
// capability behind it.
const TOOL_NAMES = [
  "create_docx", "create_html", "create_markdown", "create_pdf", "create_pptx", "create_xlsx",
  "edit_file", "find_symbol", "get_symbol_map", "glob_search", "grep_search", "list_dir",
  "read_file", "read_pdf", "recall_skill", "record_evidence", "redline_docx", "remember_preference",
  "run_docx_script", "run_pptx_script", "run_shell_command", "run_xlsx_script", "save_skill",
  "search_code", "update_tasks", "web_fetch", "write_file",
];

// Named scoring/algorithm functions — naming one of these next to its formula
// is exactly how the NCP leak happened.
const ALGORITHM_FUNCTIONS = [
  "computeConvergenceScore", "hasRecurredKnownFailure", "runDivergentRepairEnsemble", "computeRetryDelayMs",
];

// Config/env identifiers specific enough that they only ever appear if
// someone copied them straight from the real source, not from describing
// the product in plain English. Deliberately excludes .coding-agent/ itself
// and its user-facing subpaths (skills/, api-keys.json) — see file header.
const INTERNAL_IDENTIFIERS = [
  "device.json", "global-memory.json", "global-instructions.txt", "recent-folders.json",
  "skill-proposals", "memory.json",
  "WREXLYN_LICENSE_SERVER_URL", "WREXLYN_ACCEPT_TERMS_VERSION", "WREXLYN_NAME", "WREXLYN_EMAIL",
  "WREXLYN_SKIP_LICENSE_CHECK", "WREXLYN_USAGE_DIR",
];

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Prose extensions only — .html/.md (and .pptx slide text) are marketing copy, where
// naming a real route/tool reveals internal architecture. .js/.css are implementation:
// app.js legitimately calls POST /api/register to make the demo's registration work,
// the same way any client-side code calls its own backend's real endpoints.
const PROSE_ONLY_EXTENSIONS = new Set([".html", ".md", ".pptx"]);

const forbiddenPatterns = [
  ...TOOL_NAMES.map((name) => ({ pattern: new RegExp(`\\b${name}\\b`), description: `the internal tool name "${name}"` })),
  ...ALGORITHM_FUNCTIONS.map((name) => ({ pattern: new RegExp(`\\b${name}\\b`), description: `the internal function name "${name}"` })),
  ...INTERNAL_IDENTIFIERS.map((name) => ({ pattern: new RegExp(escapeRegExp(name)), description: `the internal identifier "${name}"` })),
  { pattern: /github\.com\/nishantsprabhakar\/codingagent/i, description: "a link to the private source repo" },
  { pattern: /api\.github\.com/i, description: "a direct GitHub API reference" },
  { pattern: /\bsrc\/[a-zA-Z0-9_./-]+\.tsx?\b/, description: "a literal source file path" },
  { pattern: /\b[A-Z][a-zA-Z]*Score\s*=\s*clamp\(/, description: "a literal scoring formula (Name = clamp(...))" },
  { pattern: /\/api\/(register|checkin|version)\b/, description: "a literal license-server API route", proseOnly: true },
  { pattern: /\/admin\/(login|logout|release|users)\b/, description: "a literal license-server admin route", proseOnly: true },
];

const ALLOWLIST_FILES = new Set(["scripts/check-leaks.js"]);

const failures = [];

function checkText(relativeLabel, contents, ext) {
  const isProse = PROSE_ONLY_EXTENSIONS.has(ext);
  for (const { pattern, description, proseOnly } of forbiddenPatterns) {
    if (proseOnly && !isProse) continue;
    if (pattern.test(contents)) failures.push(`${relativeLabel}: contains ${description}`);
  }
}

function scanDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      scanDirectory(path.join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (ALLOWLIST_FILES.has(relative)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (scannableExtensions.has(ext)) {
      checkText(relative, fs.readFileSync(absolute, "utf8"), ext);
    } else if (ext === ".pptx") {
      scanPptx(absolute, relative);
    }
  }
}

/** Extracts just the slide text runs (<a:t>...</a:t>) from every slide in the deck via
 *  `unzip -p`, rather than the raw XML — raw XML would false-positive on unrelated
 *  attribute values that happen to contain a forbidden substring. */
function scanPptx(absolutePath, relativeLabel) {
  let xml;
  try {
    xml = execFileSync("unzip", ["-p", absolutePath, "ppt/slides/*.xml"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    console.warn(`Warning: could not unzip ${relativeLabel} to scan its slide text (${err.message}). Skipping — verify manually.`);
    return;
  }
  const text = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1]).join(" ");
  checkText(`${relativeLabel} (slide text)`, text, ".pptx");
}

scanDirectory(root);

const totalPatterns = TOOL_NAMES.length + ALGORITHM_FUNCTIONS.length + INTERNAL_IDENTIFIERS.length + 6;

if (failures.length > 0) {
  console.error(
    "Leak check failed — public content references real internal implementation details:\n" +
      failures.map((f) => `  - ${f}`).join("\n") +
      "\n\nIf this is a false positive (a generic word that happens to match), narrow the pattern in scripts/check-leaks.js."
  );
  process.exitCode = 1;
} else {
  console.log(`Leak check passed — scanned for ${totalPatterns} forbidden patterns across all site content and decks, none found.`);
}
