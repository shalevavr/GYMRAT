const { findOne, updateOne } = require('./_lib/mongodb');
const { validateUsername, verifySession } = require('./_lib/security');

const MAX_FOOD_TEXT_LENGTH = 4000;
const DEFAULT_MODEL = 'gemini-2.5-flash';

function getAccountFilter({ username, accountKey }) {
  const cleanAccountKey = `${accountKey || ''}`.trim();
  if (cleanAccountKey.startsWith('google:')) return { accountKey: cleanAccountKey };
  return { username: validateUsername(username) };
}

function cleanDateKey(value) {
  const dateKey = `${value || ''}`.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateKey)) {
    throw new Error('Valid date is required.');
  }
  return dateKey;
}

function cleanFoodText(value) {
  const foodText = `${value || ''}`.trim();
  if (!foodText) throw new Error('Food text is required.');
  if (foodText.length > MAX_FOOD_TEXT_LENGTH) throw new Error('Food text is too long.');
  return foodText;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 10) / 10 : 0;
}

function normalizeItem(item, index) {
  const name = `${item?.name || item?.food || `Food item ${index + 1}`}`.trim().slice(0, 120) || `Food item ${index + 1}`;
  return {
    name,
    calories: Math.round(numberValue(item?.calories ?? item?.kcal)),
    protein: numberValue(item?.protein ?? item?.proteinGrams),
    carbs: numberValue(item?.carbs ?? item?.carbsGrams ?? item?.carbohydrates),
    fat: numberValue(item?.fat ?? item?.fats ?? item?.fatGrams),
  };
}

function totalsFor(items) {
  return items.reduce((total, item) => ({
    calories: total.calories + numberValue(item.calories),
    protein: total.protein + numberValue(item.protein),
    carbs: total.carbs + numberValue(item.carbs),
    fat: total.fat + numberValue(item.fat),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function extractJsonText(text) {
  const raw = `${text || ''}`.trim();
  if (!raw) throw new Error('Gemini returned an empty response.');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Gemini response was not valid JSON.');
  return candidate.slice(start, end + 1);
}

function normalizeGeminiEstimate(parsed) {
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  let items = rawItems.map(normalizeItem).filter(item => item.calories || item.protein || item.carbs || item.fat);

  if (!items.length && parsed?.totals) {
    items = [normalizeItem({ name: 'AI estimate', ...parsed.totals }, 0)];
  }

  if (!items.length) throw new Error('Gemini did not return usable nutrition values.');

  const calculatedTotals = totalsFor(items);
  const totals = parsed?.totals ? {
    calories: Math.round(numberValue(parsed.totals.calories ?? parsed.totals.kcal)) || Math.round(calculatedTotals.calories),
    protein: numberValue(parsed.totals.protein ?? parsed.totals.proteinGrams) || calculatedTotals.protein,
    carbs: numberValue(parsed.totals.carbs ?? parsed.totals.carbsGrams ?? parsed.totals.carbohydrates) || calculatedTotals.carbs,
    fat: numberValue(parsed.totals.fat ?? parsed.totals.fats ?? parsed.totals.fatGrams) || calculatedTotals.fat,
  } : calculatedTotals;

  return { items, totals };
}

function getGeminiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (typeof data?.outputText === 'string') return data.outputText;
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map(part => part.text || '').join('\n');
  const interactionParts = data?.output?.[0]?.content;
  if (Array.isArray(interactionParts)) return interactionParts.map(part => part.text || '').join('\n');
  return '';
}

async function askGeminiForNutrition(foodText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in server environment.');

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = `You are a nutrition estimator for a diet tracker. Estimate the nutrition for the user's food text. Return JSON only, with no markdown. Use this exact shape: {"items":[{"name":"string","calories":number,"protein":number,"carbs":number,"fat":number}],"totals":{"calories":number,"protein":number,"carbs":number,"fat":number}}. Values must be kcal and grams. If quantity is unclear, use a realistic common serving and include it in the item name. User food text: ${foodText}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const text = getGeminiText(data);
  const parsed = JSON.parse(extractJsonText(text));
  return { ...normalizeGeminiEstimate(parsed), model };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, accountKey, authToken } = req.body || {};
  let filter;
  let dateKey;
  let foodText;
  try {
    filter = getAccountFilter({ username, accountKey });
    dateKey = cleanDateKey(req.body?.dateKey);
    foodText = cleanFoodText(req.body?.foodText);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!authToken) return res.status(400).json({ error: 'Auth token is required.' });

  try {
    const existingUser = await findOne(filter);
    if (!existingUser) return res.status(404).json({ error: 'User not found.' });
    if (!verifySession(existingUser, authToken)) return res.status(401).json({ error: 'Unauthorized session.' });

    const estimate = await askGeminiForNutrition(foodText);
    const now = new Date().toISOString();
    const entry = {
      date: dateKey,
      requestedAt: now,
      source: 'gemini',
      model: estimate.model,
      originalFoodText: foodText,
      items: estimate.items,
      totals: estimate.totals,
    };
    const record = {
      date: dateKey,
      originalFoodText: foodText,
      items: estimate.items,
      totals: estimate.totals,
      updatedAt: now,
      aiEstimated: true,
      aiEstimateSource: 'gemini',
    };

    const result = await updateOne(filter, {
      $set: {
        [`selections.diet.recordsByDate.${dateKey}`]: record,
        [`selections.diet.aiEstimatesByDate.${dateKey}.latest`]: entry,
        [`selections.diet.aiEstimatesByDate.${dateKey}.updatedAt`]: now,
      },
      $push: {
        [`selections.diet.aiEstimatesByDate.${dateKey}.entries`]: {
          $each: [entry],
          $slice: -30,
        },
      },
    }, { upsert: false });

    if (result.matchedCount === 0) return res.status(404).json({ error: 'User not found.' });

    return res.status(200).json({ ok: true, dateKey, items: estimate.items, totals: estimate.totals, savedAt: now });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to estimate nutrition.' });
  }
};