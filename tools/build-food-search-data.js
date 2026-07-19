const fs = require("fs");
const path = require("path");

const USDA_DIR = path.resolve(__dirname, "..", "data", "usda");
const SOURCE_FILE = path.join(USDA_DIR, "food-macros-per-100g.ndjson");
const OUTPUT_FILE = path.join(USDA_DIR, "foods-search-v1.json");

const records = fs.readFileSync(SOURCE_FILE, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const item = JSON.parse(line);
    return {
      id: item.fdcId,
      n: item.name,
      cal: item.macrosPer100g.calories,
      p: item.macrosPer100g.protein,
      c: item.macrosPer100g.carbs,
      f: item.macrosPer100g.fat,
    };
  })
  .sort((left, right) => left.n.localeCompare(right.n));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
  version: "usda-generic-full-2026-04-30-v1",
  unit: "per 100g",
  count: records.length,
  foods: records,
}));

console.log({
  output: path.relative(path.resolve(__dirname, ".."), OUTPUT_FILE),
  count: records.length,
  bytes: fs.statSync(OUTPUT_FILE).size,
});
