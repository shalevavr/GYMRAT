const fs = require("fs");
const path = require("path");

const USDA_DIR = path.resolve(__dirname, "..", "data", "usda");
const SOURCE_FILE = path.join(USDA_DIR, "food-macros-per-100g.ndjson");
const OUTPUT_NDJSON = path.join(USDA_DIR, "food-macros-per-100g-simplified.ndjson");
const OUTPUT_CSV = path.join(USDA_DIR, "food-macros-per-100g-simplified.csv");
const REPORT_FILE = path.join(USDA_DIR, "food-macros-simplify-report.json");

const SIMILARITY = {
  calories: 50,
  protein: 1,
  carbs: 1,
  fat: 1,
};

const DESCRIPTOR_STOP_WORDS = new Set([
  "as",
  "to",
  "ns",
  "includes",
  "include",
  "with",
  "without",
  "and",
  "or",
  "of",
  "the",
  "for",
  "usda",
  "food",
  "distribution",
  "program",
]);

const PRIORITY_WORDS = [
  "raw",
  "fresh",
  "cooked",
  "boiled",
  "baked",
  "roasted",
  "dry",
  "dried",
  "canned",
  "frozen",
  "drained",
  "no added fat",
  "fat added",
  "with salt",
  "without salt",
  "no salt",
  "reduced sodium",
  "regular",
];

function parseNdjson(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function csvEscape(value) {
  return `"${`${value ?? ""}`.replace(/"/g, '""')}"`;
}

function writeNdjson(filePath, records) {
  fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

function writeCsv(filePath, records) {
  const header = [
    "Item + description (per 100g)",
    "Calories (kcal per 100g)",
    "Protein (g per 100g)",
    "Carbs (g per 100g)",
    "Fats (g per 100g)",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const record of records) {
    lines.push([
      record.name,
      record.macrosPer100g.calories,
      record.macrosPer100g.protein,
      record.macrosPer100g.carbs,
      record.macrosPer100g.fat,
    ].map(csvEscape).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

function titleRoot(name) {
  const firstPart = `${name}`.split(",")[0].trim().toLowerCase();
  return firstPart
    .replace(/\braw\b/g, "")
    .replace(/\bfresh\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(name) {
  return new Set(`${name}`.toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !DESCRIPTOR_STOP_WORDS.has(token)));
}

function macroDistance(left, right) {
  const a = left.macrosPer100g;
  const b = right.macrosPer100g;
  return Math.abs(a.calories - b.calories) / SIMILARITY.calories
    + Math.abs(a.protein - b.protein) / SIMILARITY.protein
    + Math.abs(a.carbs - b.carbs) / SIMILARITY.carbs
    + Math.abs(a.fat - b.fat) / SIMILARITY.fat;
}

function isMacroSimilar(left, right) {
  const a = left.macrosPer100g;
  const b = right.macrosPer100g;
  return Math.abs(a.calories - b.calories) <= SIMILARITY.calories
    && Math.abs(a.protein - b.protein) <= SIMILARITY.protein
    && Math.abs(a.carbs - b.carbs) <= SIMILARITY.carbs
    && Math.abs(a.fat - b.fat) <= SIMILARITY.fat;
}

function descriptorScore(record) {
  const name = record.name.toLowerCase();
  let score = 0;
  for (const word of PRIORITY_WORDS) {
    if (name.includes(word)) score += 2;
  }
  if (record.dataType === "foundation_food") score += 5;
  if (record.dataType === "sr_legacy_food") score += 3;
  if (record.dataType === "survey_fndds_food") score += 1;
  score -= Math.max(0, name.length - 70) / 70;
  return score;
}

function chooseRepresentatives(cluster) {
  return [cluster.slice().sort((a, b) => descriptorScore(b) - descriptorScore(a) || a.name.localeCompare(b.name))[0]];
}

function clusterRecords(records) {
  const clusters = [];
  for (const record of records) {
    let targetCluster = null;
    for (const cluster of clusters) {
      if (cluster.some((candidate) => isMacroSimilar(candidate, record))) {
        targetCluster = cluster;
        break;
      }
    }
    if (targetCluster) targetCluster.push(record);
    else clusters.push([record]);
  }
  return clusters;
}

function main() {
  const records = parseNdjson(SOURCE_FILE)
    .map((record) => ({ ...record, _tokens: tokenSet(record.name), _root: titleRoot(record.name) }));

  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record._root)) groups.set(record._root, []);
    groups.get(record._root).push(record);
  }

  const kept = [];
  const removed = [];
  const reportGroups = [];

  for (const [root, group] of groups.entries()) {
    if (group.length <= 1) {
      kept.push(...group);
      continue;
    }

    const clusters = clusterRecords(group.sort((a, b) => a.name.localeCompare(b.name)));
    const groupKept = [];
    const groupRemoved = [];

    for (const cluster of clusters) {
      const representatives = chooseRepresentatives(cluster);
      const representativeIds = new Set(representatives.map((record) => record.fdcId));
      groupKept.push(...representatives);
      groupRemoved.push(...cluster.filter((record) => !representativeIds.has(record.fdcId)));
    }

    kept.push(...groupKept);
    removed.push(...groupRemoved);

    if (groupRemoved.length > 0) {
      reportGroups.push({
        root,
        before: group.length,
        after: groupKept.length,
        removed: groupRemoved.length,
        clusterCount: clusters.length,
        examplesKept: groupKept.slice(0, 8).map((record) => record.name),
        examplesRemoved: groupRemoved.slice(0, 8).map((record) => record.name),
      });
    }
  }

  const publicKept = kept
    .map(({ _tokens, _root, ...record }) => record)
    .sort((a, b) => a.name.localeCompare(b.name));
  writeNdjson(OUTPUT_NDJSON, publicKept);
  writeCsv(OUTPUT_CSV, publicKept);

  const report = {
    method: "Grouped by leading food name before first comma, clustered by macro similarity, kept one representative per similar cluster. This keeps more than 5 records only when macro clusters are genuinely outside the similarity thresholds.",
    thresholdsPer100g: SIMILARITY,
    before: records.length,
    after: publicKept.length,
    removed: removed.length,
    groupsWithRemovals: reportGroups.length,
    largestRemovedGroups: reportGroups
      .sort((a, b) => b.removed - a.removed)
      .slice(0, 25),
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main();
