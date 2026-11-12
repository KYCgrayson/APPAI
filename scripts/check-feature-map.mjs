#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Only stars are special. Next.js [params], [...rest] and (groups) are literal.
function globRegex(glob) {
  let source = "^";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char !== "*") source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (glob[i + 1] !== "*") source += "[^/]*";
    else {
      i++;
      if (glob[i + 1] === "/") {
        source += "(?:.*/)?";
        i++;
      } else source += ".*";
    }
  }
  return new RegExp(`${source}$`, "s");
}

function globs(value, label) {
  if (!Array.isArray(value) || value.some(g => typeof g !== "string" || !g.trim())) {
    throw new Error(`${label} must be an array of nonempty glob strings`);
  }
  return value;
}

function check() {
  const map = JSON.parse(readFileSync(new URL("../docs/feature-map.json", import.meta.url), "utf8"));
  const markdown = readFileSync(new URL("../docs/FEATURE_MAP.md", import.meta.url), "utf8");
  if (!Array.isArray(map.features) || !map.features.length) {
    throw new Error("features must be a nonempty array");
  }
  const ignore = globs(map.ignore, "ignore");
  const ignored = ignore.map(globRegex);
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  }).split("\0").filter(Boolean);
  const covered = new Set();
  const ids = new Set();
  const errors = [];
  for (const [index, regex] of ignored.entries()) {
    if (!files.some(file => regex.test(file))) errors.push(`Stale glob: ignore: ${ignore[index]}`);
  }
  for (const feature of map.features) {
    if (typeof feature.id !== "string" || !/^\S+$/.test(feature.id)) {
      throw new Error("Each feature needs a nonempty ID without whitespace");
    }
    if (ids.has(feature.id)) errors.push(`Duplicate JSON ID: ${feature.id}`);
    ids.add(feature.id);
    const paths = globs(feature.paths, `${feature.id}.paths`);
    if (!paths.length) errors.push(`Feature has no paths: ${feature.id}`);
    const docs = globs(feature.docs ?? [], `${feature.id}.docs`);
    for (const [field, patterns] of [["paths", paths], ["docs", docs]]) {
      for (const glob of patterns) {
        const regex = globRegex(glob);
        const matches = files.filter(file => regex.test(file));
        if (!matches.length) errors.push(`Stale glob: ${feature.id}.${field}: ${glob}`);
        for (const file of matches) covered.add(file);
      }
    }
  }

  const headings = new Set();
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^###[ \t]+(\S+)(?:[ \t].*)?$/);
    if (!heading) continue;
    const id = heading[1];
    if (headings.has(id)) errors.push(`Duplicate Markdown ID: ${id}`);
    headings.add(id);
  }
  for (const id of ids) if (!headings.has(id)) errors.push(`Missing Markdown heading: ### ${id}`);
  for (const id of headings) if (!ids.has(id)) errors.push(`Markdown ID missing from JSON: ${id}`);

  const unmapped = files.filter(file => !covered.has(file) && !ignored.some(regex => regex.test(file)));
  for (const file of unmapped) errors.push(`Unmapped file: ${file}`);
  if (errors.length) {
    console.error(`Feature map check failed (${errors.length}):\n${errors.map(e => `  - ${e}`).join("\n")}`);
    console.error("Update docs/FEATURE_MAP.md and docs/feature-map.json in the same commit.");
    process.exitCode = 1;
    return;
  }
  console.log(`Feature map OK: ${ids.size} features; ${covered.size} mapped, ${files.length - covered.size} ignored, ${files.length} tracked files.`);
}

try {
  check();
} catch (error) {
  console.error(`Feature map check failed: ${error.message}`);
  process.exitCode = 1;
}
