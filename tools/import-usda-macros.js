const fs = require("fs");
const path = require("path");
const readline = require("readline");

const USDA_DIR = path.resolve(__dirname, "..", "data", "usda");
const OUTPUT_FILE = path.join(USDA_DIR, "food-macros-per-100g.ndjson");
const SUMMARY_FILE = path.join(USDA_DIR, "food-macros-summary.json");
const INCLUDED_DATA_TYPES = new Set(["foundation_food", "sr_legacy_food", "survey_fndds_food"]);

function findExtractDir() {
  const candidates = [
    path.join(USDA_DIR, "FoodData_Central_csv_2026-04-30"),
    path.join(USDA_DIR, "FoodData_Central_csv_2026-04-30", "FoodData_Central_csv_2026-04-30"),
  ];

  const match = candidates.find((candidate) => fs.existsSync(path.join(candidate, "food.csv")));
  if (!match) {
    throw new Error(`Could not find extracted USDA CSV folder under ${USDA_DIR}`);
  }
  return match;
}

function getFiles() {
  const extractDir = findExtractDir();
  return {
    food: path.join(extractDir, "food.csv"),
    nutrient: path.join(extractDir, "nutrient.csv"),
    foodNutrient: path.join(extractDir, "food_nutrient.csv"),
  };
}

const TARGET_NUTRIENT_IDS = {
  "1008": "calories",
  "1003": "protein",
  "1005": "carbs",
  "1004": "fat",
};

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value);
  return values;
}

async function readCsv(filePath, onRow) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;

  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    await onRow(row);
  }
}

function requireFiles(files) {
  const missing = Object.values(files).filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`Missing extracted USDA files:\n${missing.join("\n")}`);
  }
}

function roundMacro(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function hasAllMacros(macros) {
  return macros.every((value) => Number.isFinite(value));
}

async function main() {
  const files = getFiles();
  requireFiles(files);
  fs.mkdirSync(USDA_DIR, { recursive: true });

  const nutrientNames = new Map();
  await readCsv(files.nutrient, (row) => {
    if (TARGET_NUTRIENT_IDS[row.id]) {
      nutrientNames.set(row.id, {
        name: row.name,
        unitName: row.unit_name,
      });
    }
  });

  const macroIndex = new Map();
  const macroPositions = {
    calories: 0,
    protein: 1,
    carbs: 2,
    fat: 3,
  };
  await readCsv(files.foodNutrient, (row) => {
    const macroKey = TARGET_NUTRIENT_IDS[row.nutrient_id];
    if (!macroKey) return;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) return;

    let macros = macroIndex.get(row.fdc_id);
    if (!macros) {
      macros = [null, null, null, null];
      macroIndex.set(row.fdc_id, macros);
    }
    macros[macroPositions[macroKey]] = amount;
  });

  const output = fs.createWriteStream(OUTPUT_FILE, { encoding: "utf8" });
  let written = 0;
  let skipped = 0;
  const byDataType = {};

  await readCsv(files.food, (row) => {
    if (!INCLUDED_DATA_TYPES.has(row.data_type)) {
      skipped += 1;
      return;
    }

    const macros = macroIndex.get(row.fdc_id);
    if (!macros || !hasAllMacros(macros)) {
      skipped += 1;
      return;
    }

    const record = {
      fdcId: Number(row.fdc_id),
      name: row.description,
      dataType: row.data_type,
      publicationDate: row.publication_date,
      macrosPer100g: {
        calories: roundMacro(macros[0]),
        protein: roundMacro(macros[1]),
        carbs: roundMacro(macros[2]),
        fat: roundMacro(macros[3]),
      },
    };

    output.write(`${JSON.stringify(record)}\n`);
    written += 1;
    byDataType[row.data_type] = (byDataType[row.data_type] || 0) + 1;
  });

  await new Promise((resolve, reject) => {
    output.end(resolve);
    output.on("error", reject);
  });

  const summary = {
    source: "USDA FoodData Central full CSV download",
    release: "2026-04-30",
    includedDataTypes: [...INCLUDED_DATA_TYPES],
    excludedDataTypes: ["branded_food"],
    generatedAt: new Date().toISOString(),
    outputFile: path.relative(path.resolve(__dirname, ".."), OUTPUT_FILE),
    recordCount: written,
    skippedMissingAnyMacro: skipped,
    nutrientMapping: Object.entries(TARGET_NUTRIENT_IDS).map(([nutrientId, field]) => ({
      nutrientId: Number(nutrientId),
      field,
      ...nutrientNames.get(nutrientId),
    })),
    byDataType,
  };

  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
