import json
import math
import os
import random
import re
import sys
import threading
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from tkinter import Canvas, StringVar, Text, Tk, Toplevel, messagebox
from tkinter import font as tkfont
from tkinter import ttk

try:
    from bidi.algorithm import get_base_level
except ImportError:  # pragma: no cover - keeps source runs usable before dependency install
    get_base_level = None


DAILY_CALORIE_TARGET = 2100
CALORIES_PER_KG = 7700
RTL_MARK = "\u200f"
BULLET_PREFIX = "\u2022 "
BIDI_CONTROL_CHARS = "\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
NEUTRAL_RTL_CHARS = {",", ".", "+", "-", "/", "\\", ":", ";", ")", "(", "]", "[", "}", "{"}
HEBREW_TEXT_RE = re.compile(r"[\u0590-\u05ff]")
APP_BG = "#f5f5f7"
CARD_BG = "#ffffff"
TEXT_PRIMARY = "#1d1d1f"
TEXT_SECONDARY = "#6e6e73"
SEPARATOR = "#d2d2d7"
APPLE_BLUE = "#007aff"
APPLE_BLUE_ACTIVE = "#006edb"
APPLE_RED = "#ff3b30"
APPLE_RED_ACTIVE = "#d70015"
APPLE_GREEN = "#34c759"
APPLE_ORANGE = "#ff9500"
APPLE_GRAY_BUTTON = "#e9e9eb"


def app_directory() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


STORAGE_PATH = app_directory() / "calorie_storage.json"
API_CONFIG_PATH = app_directory() / "api_config.json"


class CalorieApiError(RuntimeError):
    pass


def today_local() -> date:
    return date.today()


def format_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def parse_date_text(text: str, now: date | None = None) -> date | None:
    now = now or today_local()
    cleaned = text.strip()
    if cleaned in {"היום", "את היום"}:
        return now
    if cleaned in {"אתמול", "את אתמול"}:
        return now - timedelta(days=1)

    match = re.search(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", cleaned)
    if not match:
        return None

    day = int(match.group(1))
    month = int(match.group(2))
    year_text = match.group(3)
    if year_text:
        year = int(year_text)
        if year < 100:
            year += 2000
    else:
        year = now.year

    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_storage_date(text: str) -> date:
    return datetime.strptime(text, "%d/%m/%Y").date()


def number_format(value: float | int) -> str:
    if isinstance(value, float) and not value.is_integer():
        return f"{value:,.1f}"
    return f"{int(round(value)):,}"


def has_rtl_text(text: str) -> bool:
    if get_base_level is not None:
        try:
            return get_base_level(text) == 1
        except Exception:
            pass
    return bool(HEBREW_TEXT_RE.search(text))


def strip_bidi_controls(text: str) -> str:
    return text.translate(str.maketrans("", "", BIDI_CONTROL_CHARS))


def remove_trailing_empty_bullets(text: str) -> str:
    return re.sub(r"(?:\n\s*\u2022\s*)+$", "", text).strip()


def hebrew_status(difference: int) -> str:
    if difference > 0:
        return "גירעון"
    if difference < 0:
        return "עודף"
    return "בדיוק ביעד"


def load_api_config() -> dict:
    config = {
        "provider": "gemini",
        "model": "gemini-flash-lite-latest",
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "api_key": os.environ.get("GEMINI_API_KEY", ""),
        "timeout_seconds": 30,
    }
    if API_CONFIG_PATH.exists():
        try:
            with API_CONFIG_PATH.open("r", encoding="utf-8") as file:
                file_config = json.load(file)
            if isinstance(file_config, dict):
                config.update({key: value for key, value in file_config.items() if value not in (None, "")})
        except Exception as exc:
            raise CalorieApiError(f"לא הצלחתי לקרוא את קובץ הגדרות ה-API: {exc}") from exc
    if not config.get("api_key"):
        raise CalorieApiError("חסר מפתח API. הגדר GEMINI_API_KEY או api_config.json.")
    return config


def calorie_prompt(food_text: str) -> str:
    return (
        "אתה מעריך קלוריות ומאקרו-נוטריינטים לארוחה לפי תיאור חופשי בעברית או באנגלית.\n"
        "החזר JSON בלבד, בלי Markdown ובלי טקסט נוסף.\n"
        "השתמש בטווח הגיוני כשיש אי-ודאות בגודל מנה או אופן הכנה.\n\n"
        f"המשתמש אכל: {food_text}\n"
        "החזר JSON בלבד:\n"
        "{\n"
        '  "calories_min": number,\n'
        '  "calories_max": number,\n'
        '  "calories_estimate": number,\n'
        '  "protein_g": number,\n'
        '  "carbs_g": number,\n'
        '  "fat_g": number,\n'
        '  "explanation": "short Hebrew explanation",\n'
        '  "items": [\n'
        '    {"name": "פריט כפי שהמשתמש תיאר", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}\n'
        "  ]\n"
        "}"
    )


def bulk_recalculation_prompt(records: list[dict]) -> str:
    compact_records = [
        {
            "date": record.get("date", ""),
            "original_food_text": record.get("originalFoodText", ""),
        }
        for record in records
    ]
    return (
        "אתה מחשב מחדש קלוריות ומאקרו-נוטריינטים לרשומות אכילה יומיות.\n"
        "החזר JSON בלבד, בלי Markdown ובלי טקסט נוסף.\n"
        "חובה להחזיר רשומה אחת לכל תאריך שהתקבל, עם אותו ערך date בדיוק.\n"
        "השתמש בטווח הגיוני כשיש אי-ודאות בגודל מנה או אופן הכנה.\n\n"
        "הרשומות לחישוב מחדש:\n"
        f"{json.dumps(compact_records, ensure_ascii=False)}\n\n"
        "החזר JSON בלבד במבנה הזה:\n"
        "{\n"
        '  "records": [\n'
        "    {\n"
        '      "date": "DD/MM/YYYY",\n'
        '      "calories_min": number,\n'
        '      "calories_max": number,\n'
        '      "calories_estimate": number,\n'
        '      "protein_g": number,\n'
        '      "carbs_g": number,\n'
        '      "fat_g": number,\n'
        '      "explanation": "short Hebrew explanation",\n'
        '      "items": [\n'
        '        {"name": "פריט כפי שהמשתמש תיאר", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}"
    )


def lunch_recipe_prompt(recent_recipes: list | None = None) -> str:
    cuisines = [
        "ים תיכוני",
        "ישראלי ביתי",
        "אסייתי ללא מוקפץ",
        "מקסיקני קל",
        "הודי עדין",
        "איטלקי קל",
        "מרוקאי/צפון אפריקאי קל",
        "יווני קל",
    ]
    techniques = [
        "תנור",
        "מחבת עם רוטב",
        "סיר אחד",
        "אייר פרייר",
        "גריל או פלנצ'ה",
        "צלייה קצרה ואז רוטב",
        "נתחים ברוטב סמיך",
        "שיפודים/נתחים על פלנצ'ה",
        "תבשיל ירקות חם",
    ]
    everyday_proteins = [
        "חזה עוף",
        "פרגיות נקיות משומן",
        "בשר בקר רזה שאינו טחון",
        "רצועות הודו",
        "נתחי עוף מפורק",
        "טופו צרוב",
        "סטייק עוף דק",
        "שווארמה ביתית מחזה עוף",
        "קוביות עוף ברוטב",
        "רצועות בקר רזה מוקפצות קלות",
        "שיפודי פרגית בתיבול חזק",
        "חזה עוף במרינדת לימון ושום",
        "נתחי הודו ברוטב עגבניות חריף עדין",
        "טופו ברוטב בוטנים קל",
        "טופו ברוטב עגבניות ופפריקה",
        "פילה דג לבן בתנור",
        "סינטה רזה בפרוסות דקות",
        "שייטל רזה בפרוסות דקות",
        "נתחי עוף בסגנון מעורב ירושלמי קל",
        "חזה עוף ממולא בירקות ועשבי תיבול",
    ]
    occasional_ground_proteins = [
        "עוף טחון רזה",
        "קציצות עוף",
        "קציצות בקר רזה",
        "קבב בקר רזה קטן",
        "בשר טחון בקר רגיל במנה קטנה כי לרוב יש בו 20%-25% שומן",
        "בקר טחון רזה 5%-10% שומן רק אם מצוין במפורש שהוא רזה",
    ]
    if random.random() < 0.18:
        everyday_proteins.append("דג לבן רזה")
    carbs = [
        "ללא פחמימה עמילנית",
        "אורז בסמטי רגיל בכמות מדודה",
        "אורז בסמטי רגיל בכמות מדודה",
        "אורז בסמטי רגיל בכמות מדודה",
        "אורז יסמין/פרסי רגיל בכמות מדודה",
        "אורז מלא רק אם הוא מתאים במיוחד למנה",
        "בורגול בכמות מדודה",
        "קוסקוס מלא בכמות מדודה",
        "תפוח אדמה קטן",
        "אטריות אורז בכמות קטנה",
        "קטניות בכמות מדודה",
    ]
    avoid_recent = ""
    recent_text = ""
    if recent_recipes:
        names = []
        for recipe in recent_recipes[-8:]:
            if isinstance(recipe, dict):
                name = str(recipe.get("dish_name", "")).strip()
                style = str(recipe.get("style", "")).strip()
                if name or style:
                    names.append(f"{name} ({style})".strip())
            else:
                name = str(recipe).strip()
                if name:
                    names.append(name)
        if names:
            recent_text = " ".join(names)
            avoid_recent = "אל תחזור על המנות/הסגנונות האחרונים האלה: " + "; ".join(names) + ".\n"

    cuisine = random.choice(cuisines)
    recent_was_ground = any(word in recent_text for word in ("טחון", "קציצ", "קבב", "המבורגר"))
    use_ground = (not recent_was_ground) and random.random() < 0.08
    protein = random.choice(occasional_ground_proteins if use_ground else everyday_proteins)
    if any(word in protein for word in ("טחון", "קציצ", "קבב")):
        technique = random.choice(["קציצות ברוטב קל", "קבבים קטנים על פלנצ'ה", "מחבת עם רוטב"])
    else:
        technique = random.choice(techniques)
    carb = random.choice(carbs)

    return (
        "צור הצעת ארוחת צהריים יומית בעברית בלבד לאדם שרוצה להיכנס לגרעון קלורי, "
        "במיוחד כי הוא אוכל יותר בערב ולכן הצהריים צריכה להיות משביעה וקלה קלורית.\n"
        "המנה צריכה להרגיש כמו אוכל של מסעדה טובה או מסעדת פועלים מוצלחת: רוטב מעניין, תיבול חכם, נראות יפה, "
        "טעמים חזקים ומספקים, וריח/מרקם שיגרמו למשתמש לרצות לאכול את זה שוב. "
        "אבל היא עדיין חייבת להיות פשוטה, דיאטטית, עם מצרכים זמינים וללא הרבה שמן.\n"
        "הפעם חובה ליצור מנה שונה באמת לפי ההגרלה הבאה:\n"
        f"- סגנון מטבח: {cuisine}.\n"
        f"- טכניקת הכנה מרכזית: {technique}.\n"
        f"- חלבון מרכזי: {protein}.\n"
        f"- פחמימה/בסיס: {carb}.\n"
        f"{avoid_recent}"
        "דרישות חובה:\n"
        "- מנה חמה בלבד, לא קרה.\n"
        "- עד 20 דקות עבודת הכנה אקטיבית. זמן בישול/אפייה/סיר לא נחשב.\n"
        "- הכיוון התזונתי הוא יותר חלבון ופחות שומן ככל האפשר, בלי להפוך את המנה ליבשה או לא טעימה.\n"
        "- המבנה חייב להיות: מנה עיקרית מבוססת עוף/בשר/טופו/דג + שתי תוספות. אחת משתי התוספות חייבת להיות פחמימה מורכבת ככל האפשר.\n"
        "- המשתמש אוכל לעיתים קרובות אורז בסמטי רגיל. אל תחליף אוטומטית לאורז חום/מלא; בסמטי רגיל בכמות מדודה הוא תוספת לגיטימית ומועדפת בהרבה מנות.\n"
        "- אורז מלא/חום או בורגול הם אפשרות לגיוון, אבל לא ברירת מחדל קבועה.\n"
        "- אל תיצור שוב אותה תבנית של מוקפץ עוף אסייתי. אם הסגנון אינו אסייתי, אל תשתמש בסויה/ג'ינג'ר/טריאקי.\n"
        "- צור גיוון אמיתי בין ימים: רוטב אחר, ירקות אחרים, תבלינים חזקים אחרים, שיטת הכנה אחרת ושם מנה אחר. אסור להחזיר פעמיים את אותה מנה.\n"
        "- העדף מנות עם אופי ברור וטעם עמוק: חמוץ-חריף, מעושן, שום/לימון, כמון/פפריקה, עשבי תיבול, חריף עדין או רוטב עגבניות/יוגורט/טחינה קל לפי הסגנון.\n"
        "- קציצות, קבב או בשר טחון הם אופציה נדירה בלבד, לא ברירת המחדל. ברוב הימים העדף נתחים: חזה עוף, פרגית, הודו, בקר רזה שאינו טחון, דג או טופו.\n"
        "- אל תשלב באותה מנה בקר טחון ועוף טחון. אם נבחר טחון, השתמש בסוג אחד בלבד ובכמות מדודה.\n"
        "- אם אחת המנות האחרונות הייתה קציצות/קבב/טחון, אל תחזיר שוב קציצות/קבב/טחון בהצעה הנוכחית.\n"
        "- אם כתוב בשר טחון בלי ציון 'רזה', הנח שהוא רגיל עם 20%-25% שומן ולכן השתמש בכמות קטנה יותר או אזן עם עוף/טופו והרבה ירקות.\n"
        "- מותר להציע דג רק אם הוא נבחר כחלבון בהגרלה.\n"
        "- הימנע ממנות עתירות כולסטרול; ביצים/איברים פנימיים/כמות גדולה של גבינות שמנות רק לעיתים נדירות. בקר רזה מותר אבל לא בכל הצעה.\n"
        "- המנה צריכה להיות משביעה: חלבון גבוה, ירקות/נפח, מעט שמן, ופחמימה מורכבת מדודה.\n"
        "- החזר מתכון פרקטי, פשוט, עם מצרכים זמינים.\n"
        "- אל תציע סלט קר כמנה עיקרית.\n"
        "- הערכים התזונתיים יהיו למנה אחת.\n\n"
        "החזר JSON בלבד, בלי Markdown ובלי טקסט נוסף, במבנה הזה:\n"
        "{\n"
        '  "dish_name": "שם המנה בעברית",\n'
        '  "calories": number,\n'
        '  "protein_g": number,\n'
        '  "fat_g": number,\n'
        '  "carbs_g": number,\n'
        '  "active_prep_minutes": number,\n'
        '  "style": "סגנון המטבח שנבחר",\n'
        '  "short_reason": "משפט קצר למה זה מתאים לגרעון קלורי",\n'
        '  "ingredients": ["מצרך 1 עם כמות", "מצרך 2 עם כמות"],\n'
        '  "preparation": ["שלב 1", "שלב 2"],\n'
        '  "notes": "הערה קצרה אם יש"\n'
        "}"
    )


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def generate_lunch_recipe_tip_with_api(recent_recipes: list | None = None) -> dict:
    config = load_api_config()
    model = str(config["model"])
    endpoint_template = str(config["endpoint"])
    endpoint = endpoint_template.format(model=model)
    api_key = str(config["api_key"])
    timeout = int(config.get("timeout_seconds", 30))

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": lunch_recipe_prompt(recent_recipes)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.85,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "dish_name": {"type": "STRING"},
                    "calories": {"type": "NUMBER"},
                    "protein_g": {"type": "NUMBER"},
                    "fat_g": {"type": "NUMBER"},
                    "carbs_g": {"type": "NUMBER"},
                    "active_prep_minutes": {"type": "NUMBER"},
                    "style": {"type": "STRING"},
                    "short_reason": {"type": "STRING"},
                    "ingredients": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "preparation": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "notes": {"type": "STRING"},
                },
                "required": [
                    "dish_name",
                    "calories",
                    "protein_g",
                    "fat_g",
                    "carbs_g",
                    "active_prep_minutes",
                    "style",
                    "short_reason",
                    "ingredients",
                    "preparation",
                    "notes",
                ],
            },
        },
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise CalorieApiError(f"שגיאת API ({exc.code}): {message[:300]}") from exc
    except urllib.error.URLError as exc:
        raise CalorieApiError(f"לא הצלחתי להתחבר ל-API: {exc.reason}") from exc
    except TimeoutError as exc:
        raise CalorieApiError("החיבור ל-API ארך יותר מדי זמן.") from exc

    try:
        text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        data = extract_json_object(text)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        raise CalorieApiError("ה-API לא החזיר JSON תקין של הצעת צהריים.") from exc

    return validate_lunch_recipe_tip(data)


def validate_lunch_recipe_tip(data: dict) -> dict:
    required = (
        "dish_name",
        "calories",
        "protein_g",
        "fat_g",
        "carbs_g",
        "active_prep_minutes",
        "style",
        "short_reason",
        "ingredients",
        "preparation",
        "notes",
    )
    missing = [key for key in required if key not in data]
    if missing:
        raise CalorieApiError(f"ה-API החזיר הצעת צהריים חסרה: {', '.join(missing)}")

    ingredients = data.get("ingredients")
    preparation = data.get("preparation")
    if not isinstance(ingredients, list) or not ingredients:
        raise CalorieApiError("ה-API לא החזיר רשימת מצרכים תקינה.")
    if not isinstance(preparation, list) or not preparation:
        raise CalorieApiError("ה-API לא החזיר הוראות הכנה תקינות.")

    return {
        "dish_name": str(data["dish_name"]).strip(),
        "calories": int(round(float(data["calories"]))),
        "protein_g": int(round(float(data["protein_g"]))),
        "fat_g": int(round(float(data["fat_g"]))),
        "carbs_g": int(round(float(data["carbs_g"]))),
        "active_prep_minutes": int(round(float(data["active_prep_minutes"]))),
        "style": str(data["style"]).strip(),
        "short_reason": str(data["short_reason"]).strip(),
        "ingredients": [str(item).strip() for item in ingredients if str(item).strip()],
        "preparation": [str(item).strip() for item in preparation if str(item).strip()],
        "notes": str(data.get("notes", "")).strip(),
    }


def validate_calorie_response(data: dict) -> dict:
    required = ("calories_min", "calories_max", "calories_estimate", "protein_g", "carbs_g", "fat_g", "explanation")
    missing = [key for key in required if key not in data]
    if missing:
        raise CalorieApiError(f"ה-API החזיר JSON חסר: {', '.join(missing)}")

    try:
        calories_min = int(round(float(data["calories_min"])))
        calories_max = int(round(float(data["calories_max"])))
        estimate = int(round(float(data["calories_estimate"])))
        protein_g = max(0, int(round(float(data["protein_g"]))))
        carbs_g = max(0, int(round(float(data["carbs_g"]))))
        fat_g = max(0, int(round(float(data["fat_g"]))))
    except (TypeError, ValueError) as exc:
        raise CalorieApiError("ה-API החזיר ערכי קלוריות או מאקרו לא תקינים.") from exc

    if calories_min < 0 or calories_max < 0 or estimate < 0:
        raise CalorieApiError("ה-API החזיר ערכי קלוריות שליליים.")
    if calories_min > calories_max:
        calories_min, calories_max = calories_max, calories_min
    estimate = min(max(estimate, calories_min), calories_max)

    explanation = str(data["explanation"]).strip()
    if not explanation:
        explanation = "הערכה לפי התיאור שהוזן."

    items = []
    raw_items = data.get("items", [])
    if isinstance(raw_items, list):
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                continue
            name = str(raw_item.get("name", "")).strip()
            if not name:
                continue
            try:
                calories = max(0, int(round(float(raw_item.get("calories", 0)))))
                item_protein = max(0, int(round(float(raw_item.get("protein_g", 0)))))
                item_carbs = max(0, int(round(float(raw_item.get("carbs_g", 0)))))
                item_fat = max(0, int(round(float(raw_item.get("fat_g", 0)))))
            except (TypeError, ValueError):
                continue
            items.append(
                {
                    "name": name,
                    "calories": calories,
                    "protein_g": item_protein,
                    "carbs_g": item_carbs,
                    "fat_g": item_fat,
                }
            )

    return {
        "calories_min": calories_min,
        "calories_max": calories_max,
        "calories_estimate": estimate,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
        "explanation": explanation,
        "items": items,
    }


def estimate_calories_with_api(food_text: str) -> dict:
    config = load_api_config()
    model = str(config["model"])
    endpoint_template = str(config["endpoint"])
    endpoint = endpoint_template.format(model=model)
    api_key = str(config["api_key"])
    timeout = int(config.get("timeout_seconds", 30))

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": calorie_prompt(food_text)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "calories_min": {"type": "NUMBER"},
                    "calories_max": {"type": "NUMBER"},
                    "calories_estimate": {"type": "NUMBER"},
                    "protein_g": {"type": "NUMBER"},
                    "carbs_g": {"type": "NUMBER"},
                    "fat_g": {"type": "NUMBER"},
                    "explanation": {"type": "STRING"},
                    "items": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "calories": {"type": "NUMBER"},
                                "protein_g": {"type": "NUMBER"},
                                "carbs_g": {"type": "NUMBER"},
                                "fat_g": {"type": "NUMBER"},
                            },
                            "required": ["name", "calories", "protein_g", "carbs_g", "fat_g"],
                        },
                    },
                },
                "required": [
                    "calories_min",
                    "calories_max",
                    "calories_estimate",
                    "protein_g",
                    "carbs_g",
                    "fat_g",
                    "explanation",
                    "items",
                ],
            },
        },
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise CalorieApiError(f"שגיאת API ({exc.code}): {message[:300]}") from exc
    except urllib.error.URLError as exc:
        raise CalorieApiError(f"לא הצלחתי להתחבר ל-API: {exc.reason}") from exc
    except TimeoutError as exc:
        raise CalorieApiError("החיבור ל-API ארך יותר מדי זמן.") from exc

    try:
        text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        return validate_calorie_response(extract_json_object(text))
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        raise CalorieApiError("ה-API לא החזיר JSON תקין של הערכת קלוריות.") from exc


def normalize_calorie_items(food_text: str, api_result: dict) -> tuple[int, list[dict]]:
    total = api_result["calories_estimate"]
    breakdown = api_result.get("items") or [
        {
            "name": food_text,
            "calories": total,
            "protein_g": api_result["protein_g"],
            "carbs_g": api_result["carbs_g"],
            "fat_g": api_result["fat_g"],
        }
    ]
    items = []
    for item in breakdown:
        calories = max(0, int(item.get("calories", 0)))
        protein_g = max(0, int(item.get("protein_g", 0)))
        carbs_g = max(0, int(item.get("carbs_g", 0)))
        fat_g = max(0, int(item.get("fat_g", 0)))
        items.append(
            {
                "name": item.get("name", "").strip() or food_text,
                "quantityDescription": f"{calories} קלוריות",
                "estimatedCalories": calories,
                "proteinGrams": protein_g,
                "carbsGrams": carbs_g,
                "fatGrams": fat_g,
                "caloriesMin": calories,
                "caloriesMax": calories,
                "confidence": "medium",
                "notes": api_result["explanation"],
            }
        )
    item_total = sum(item["estimatedCalories"] for item in items)
    if items and item_total != total:
        if item_total > 0:
            scaled_total = 0
            for item in items[:-1]:
                item["estimatedCalories"] = max(0, int(round(item["estimatedCalories"] * total / item_total)))
                scaled_total += item["estimatedCalories"]
            items[-1]["estimatedCalories"] = max(0, total - scaled_total)
        else:
            items[-1]["estimatedCalories"] = total
        for item in items:
            item["quantityDescription"] = f"{item['estimatedCalories']} קלוריות"
            item["caloriesMin"] = item["estimatedCalories"]
            item["caloriesMax"] = item["estimatedCalories"]
    return max(0, int(total)), items


def estimate_calories(food_text: str) -> tuple[int, list[dict], bool]:
    api_result = estimate_calories_with_api(food_text)
    total, items = normalize_calorie_items(food_text, api_result)
    return total, items, True


def build_record_from_api_result(
    date_text: str,
    food_text: str,
    api_result: dict,
    existing_created_at: str | None = None,
    updated_at: str | None = None,
) -> dict:
    total, items = normalize_calorie_items(food_text, api_result)
    api_item = items[0] if items else {}
    protein_total = sum(macro_value(item, "proteinGrams") for item in items)
    carbs_total = sum(macro_value(item, "carbsGrams") for item in items)
    fat_total = sum(macro_value(item, "fatGrams") for item in items)
    difference = DAILY_CALORIE_TARGET - total
    now = updated_at or datetime.now().isoformat(timespec="seconds")
    return {
        "date": date_text,
        "caloriesConsumed": total,
        "proteinGrams": protein_total,
        "carbsGrams": carbs_total,
        "fatGrams": fat_total,
        "caloriesMin": api_item.get("caloriesMin", total),
        "caloriesMax": api_item.get("caloriesMax", total),
        "calorieTarget": DAILY_CALORIE_TARGET,
        "difference": difference,
        "status": "deficit" if difference > 0 else "surplus" if difference < 0 else "exact",
        "originalFoodText": food_text,
        "estimatedItems": items,
        "apiExplanation": api_item.get("notes", ""),
        "createdAt": existing_created_at or now,
        "updatedAt": now,
    }


def create_record(date_text: str, food_text: str, existing_created_at: str | None = None) -> dict:
    api_result = estimate_calories_with_api(food_text)
    return build_record_from_api_result(date_text, food_text, api_result, existing_created_at)


def macro_value(data: dict, key: str) -> int:
    try:
        return max(0, int(round(float(data.get(key, 0)))))
    except (TypeError, ValueError):
        return 0


def bulk_recalculation_schema() -> dict:
    return {
        "type": "OBJECT",
        "properties": {
            "records": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "date": {"type": "STRING"},
                        "calories_min": {"type": "NUMBER"},
                        "calories_max": {"type": "NUMBER"},
                        "calories_estimate": {"type": "NUMBER"},
                        "protein_g": {"type": "NUMBER"},
                        "carbs_g": {"type": "NUMBER"},
                        "fat_g": {"type": "NUMBER"},
                        "explanation": {"type": "STRING"},
                        "items": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "name": {"type": "STRING"},
                                    "calories": {"type": "NUMBER"},
                                    "protein_g": {"type": "NUMBER"},
                                    "carbs_g": {"type": "NUMBER"},
                                    "fat_g": {"type": "NUMBER"},
                                },
                                "required": ["name", "calories", "protein_g", "carbs_g", "fat_g"],
                            },
                        },
                    },
                    "required": [
                        "date",
                        "calories_min",
                        "calories_max",
                        "calories_estimate",
                        "protein_g",
                        "carbs_g",
                        "fat_g",
                        "explanation",
                        "items",
                    ],
                },
            }
        },
        "required": ["records"],
    }


def recalculate_records_with_api(records: list[dict]) -> list[dict]:
    valid_records = list(records)
    if not valid_records:
        raise CalorieApiError("אין רשומות עם תיאור אוכל לחישוב מחדש.")
    missing_dates = [str(record.get("date", "")).strip() or "<ללא תאריך>" for record in valid_records if not str(record.get("date", "")).strip()]
    missing_food = [str(record.get("date", "")).strip() or "<ללא תאריך>" for record in valid_records if not str(record.get("originalFoodText", "")).strip()]
    if missing_dates:
        raise CalorieApiError("יש רשומות ללא תאריך ולכן אי אפשר לחשב מחדש את כל הקובץ.")
    if missing_food:
        raise CalorieApiError("יש רשומות ללא תיאור אוכל ולכן אי אפשר לחשב מחדש את כל הקובץ: " + ", ".join(missing_food[:5]))

    config = load_api_config()
    model = str(config["model"])
    endpoint_template = str(config["endpoint"])
    endpoint = endpoint_template.format(model=model)
    api_key = str(config["api_key"])
    timeout = int(config.get("timeout_seconds", 30))

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": bulk_recalculation_prompt(valid_records)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": bulk_recalculation_schema(),
        },
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise CalorieApiError(f"שגיאת API ({exc.code}): {message[:300]}") from exc
    except urllib.error.URLError as exc:
        raise CalorieApiError(f"לא הצלחתי להתחבר ל-API: {exc.reason}") from exc
    except TimeoutError as exc:
        raise CalorieApiError("החיבור ל-API ארך יותר מדי זמן.") from exc

    try:
        text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        data = extract_json_object(text)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        raise CalorieApiError("ה-API לא החזיר JSON תקין של חישוב מחדש.") from exc

    raw_results = data.get("records")
    if not isinstance(raw_results, list):
        raise CalorieApiError("ה-API לא החזיר רשימת רשומות תקינה.")

    results_by_date = {}
    for raw_result in raw_results:
        if not isinstance(raw_result, dict):
            continue
        date_text = str(raw_result.get("date", "")).strip()
        if date_text:
            results_by_date[date_text] = raw_result

    existing_by_date = {record["date"]: record for record in valid_records}
    missing_dates = [date_text for date_text in existing_by_date if date_text not in results_by_date]
    if missing_dates:
        raise CalorieApiError("ה-API לא החזיר חישוב לכל התאריכים: " + ", ".join(missing_dates[:5]))

    updated_at = datetime.now().isoformat(timespec="seconds")
    recalculated = []
    for date_text, existing in existing_by_date.items():
        api_result = validate_calorie_response(results_by_date[date_text])
        recalculated.append(
            build_record_from_api_result(
                date_text,
                existing.get("originalFoodText", ""),
                api_result,
                existing.get("createdAt"),
                updated_at,
            )
        )
    return recalculated


def week_bounds(target: date) -> tuple[date, date]:
    start = target - timedelta(days=target.weekday())
    return start, start + timedelta(days=6)


def weekly_trend(records: list[dict], target_date_text: str) -> dict | None:
    if not records:
        return None
    target = parse_storage_date(target_date_text)
    start, end = week_bounds(target)
    week_records = [
        record
        for record in records
        if start <= parse_storage_date(record["date"]) <= end
    ]
    if not week_records:
        return None

    average = sum(record["difference"] for record in week_records) / len(week_records)
    weekly_calories = average * 7
    estimated_kg = abs(weekly_calories / CALORIES_PER_KG)
    direction = "loss" if average > 0 else "gain" if average < 0 else "neutral"
    return {
        "averageDailyDifference": average,
        "weeklyCalories": weekly_calories,
        "estimatedKgChange": estimated_kg,
        "direction": direction,
    }


def trend_message(trend: dict | None) -> str:
    if not trend:
        return ""
    average = abs(round(trend["averageDailyDifference"]))
    kg = trend["estimatedKgChange"]
    kg_text = f"{kg:.2f}".rstrip("0").rstrip(".")
    if trend["direction"] == "loss":
        return f"בהתבסס על גירעון שבועי ממוצע של {number_format(average)} קלוריות ביום, אתה צפוי לרדת כ-{kg_text} ק״ג בשבוע."
    if trend["direction"] == "gain":
        return f"בהתבסס על עודף שבועי ממוצע של {number_format(average)} קלוריות ביום, אתה צפוי לעלות כ-{kg_text} ק״ג בשבוע."
    return "בהתבסס על הימים שנרשמו השבוע, אתה צפוי להישאר בערך באותו משקל."


def record_message(record: dict, trend: dict | None) -> str:
    diff_abs = abs(record["difference"])
    lines = [
        f"צרכת {number_format(record['caloriesConsumed'])} מתוך {number_format(record['calorieTarget'])} קלוריות."
    ]
    if record["difference"] > 0:
        lines.append(f"אתה בגירעון של {number_format(diff_abs)} קלוריות.")
    elif record["difference"] < 0:
        lines.append(f"אתה בעודף של {number_format(diff_abs)} קלוריות.")
    else:
        lines.append("הגעת בדיוק ליעד היומי.")
    explanation = record.get("apiExplanation") or "החישוב משוער לפי התיאור שהוזן."
    if record.get("caloriesMin") is not None and record.get("caloriesMax") is not None:
        lines.append(f"טווח משוער: {number_format(record['caloriesMin'])}–{number_format(record['caloriesMax'])} קלוריות.")
    lines.append(explanation)
    weekly = trend_message(trend)
    if weekly:
        lines.append(weekly)
    return "\n".join(lines)


def load_state() -> dict:
    if not STORAGE_PATH.exists():
        return {"recordsByDate": {}}
    try:
        with STORAGE_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if not isinstance(data, dict) or not isinstance(data.get("recordsByDate"), dict):
            raise ValueError("Invalid storage shape")
        return data
    except Exception:
        backup = STORAGE_PATH.with_suffix(".json.bak")
        try:
            STORAGE_PATH.replace(backup)
        except OSError:
            pass
        return {"recordsByDate": {}}


def save_state(state: dict) -> None:
    STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if STORAGE_PATH.exists():
        backup = STORAGE_PATH.with_name(f"{STORAGE_PATH.stem}.{datetime.now().strftime('%Y%m%d-%H%M%S')}.bak")
        try:
            backup.write_text(STORAGE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
        except OSError:
            pass
    with STORAGE_PATH.open("w", encoding="utf-8") as file:
        json.dump(state, file, ensure_ascii=False, indent=2)


class CalorieCounterApp:
    def __init__(self, root: Tk) -> None:
        self.root = root
        self.root.title("מונה קלוריות יומי")
        self.root.geometry("1120x780")
        self.root.minsize(980, 680)
        self.root.configure(bg=APP_BG)

        self.state = load_state()
        self.selected_period = StringVar(value="week")
        self.date_choice = StringVar(value="היום")
        self.custom_date = StringVar()
        self.result_text = StringVar(value="בחר תאריך, כתוב מה אכלת ושמור את הרשומה.")
        self.loading = False
        self.spinner_angle = 0
        self.font_body = tkfont.Font(root=self.root, family="Segoe UI", size=12)
        self.font_small = tkfont.Font(root=self.root, family="Segoe UI", size=10)
        self.font_button = tkfont.Font(root=self.root, family="Segoe UI", size=11)
        self.font_primary_button = tkfont.Font(root=self.root, family="Segoe UI", size=12, weight="bold")
        self.font_icon = tkfont.Font(root=self.root, family="Segoe UI", size=16)
        self.font_title = tkfont.Font(root=self.root, family="Segoe UI", size=26, weight="bold")
        self.font_section = tkfont.Font(root=self.root, family="Segoe UI", size=13, weight="bold")
        self.font_input = tkfont.Font(root=self.root, family="Segoe UI", size=13)
        self.font_graph = tkfont.Font(root=self.root, family="Segoe UI", size=8)
        self.font_graph_label = tkfont.Font(root=self.root, family="Segoe UI", size=9, weight="bold")
        self.configure_style()
        self.build_layout()
        self.refresh_all()

    def configure_style(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background=APP_BG)
        style.configure("Panel.TFrame", background=CARD_BG)
        style.configure("Card.TFrame", background=CARD_BG, borderwidth=0, relief="flat")
        style.configure("TLabel", background=APP_BG, foreground=TEXT_PRIMARY, font=self.font_body)
        style.configure("Panel.TLabel", background=CARD_BG, foreground=TEXT_PRIMARY, font=self.font_body)
        style.configure("Title.TLabel", background=APP_BG, foreground=TEXT_PRIMARY, font=self.font_title)
        style.configure("Subtitle.TLabel", background=APP_BG, foreground=TEXT_SECONDARY, font=self.font_body)
        style.configure("Section.TLabel", background=CARD_BG, foreground=TEXT_PRIMARY, font=self.font_section)
        style.configure("Hint.TLabel", background=CARD_BG, foreground=TEXT_SECONDARY, font=self.font_small)
        style.configure("TButton", font=self.font_button, padding=(14, 8), background=APPLE_GRAY_BUTTON, foreground=TEXT_PRIMARY, borderwidth=0, focusthickness=0)
        style.map("TButton", background=[("active", "#dedee3"), ("pressed", "#d8d8de")])
        style.configure("Icon.TButton", font=self.font_icon, padding=(12, 4), background=APPLE_GRAY_BUTTON, foreground=TEXT_PRIMARY, borderwidth=0, focusthickness=0)
        style.map("Icon.TButton", background=[("active", "#dedee3"), ("pressed", "#d8d8de")])
        style.configure("Primary.TButton", font=self.font_primary_button, padding=(16, 9), background=APPLE_BLUE, foreground="#ffffff", borderwidth=0, focusthickness=0)
        style.map("Primary.TButton", background=[("active", APPLE_BLUE_ACTIVE), ("pressed", "#005bb5")], foreground=[("disabled", "#ffffff")])
        style.configure("Danger.TButton", font=self.font_button, padding=(14, 8), background=APPLE_RED, foreground="#ffffff", borderwidth=0, focusthickness=0)
        style.map("Danger.TButton", background=[("active", APPLE_RED_ACTIVE), ("pressed", "#b80011")])
        style.configure("TRadiobutton", background=CARD_BG, foreground=TEXT_PRIMARY, font=self.font_button, padding=(8, 4), focuscolor=CARD_BG)
        style.map("TRadiobutton", background=[("active", CARD_BG)], foreground=[("active", TEXT_PRIMARY)])
        style.configure("TEntry", fieldbackground="#fbfbfd", foreground=TEXT_PRIMARY, bordercolor=SEPARATOR, lightcolor=SEPARATOR, darkcolor=SEPARATOR, padding=(10, 8), borderwidth=1)
        style.map("TEntry", bordercolor=[("focus", APPLE_BLUE)])
        style.configure("Treeview", rowheight=32, font=self.font_small, background=CARD_BG, fieldbackground=CARD_BG, foreground=TEXT_PRIMARY, borderwidth=0)
        style.map("Treeview", background=[("selected", "#dbeafe")], foreground=[("selected", TEXT_PRIMARY)])
        style.configure("Treeview.Heading", font=self.font_small, background="#f5f5f7", foreground=TEXT_SECONDARY, borderwidth=0, relief="flat")

    def build_layout(self) -> None:
        shell = ttk.Frame(self.root, padding=22)
        shell.pack(fill="both", expand=True)

        header = ttk.Frame(shell)
        header.pack(fill="x")
        ttk.Label(header, text="מונה קלוריות יומי", style="Title.TLabel", anchor="e").pack(fill="x")
        ttk.Label(
            header,
            text="יעד יומי קבוע: 2,100 קלוריות",
            style="Subtitle.TLabel",
            anchor="e",
        ).pack(fill="x", pady=(2, 18))

        main = ttk.Frame(shell)
        main.pack(fill="both", expand=True)
        main.columnconfigure(0, weight=1)
        main.columnconfigure(1, weight=1)
        main.rowconfigure(0, weight=1)

        form = ttk.Frame(main, style="Card.TFrame", padding=20)
        form.grid(row=0, column=1, sticky="nsew", padx=(10, 0))

        ttk.Label(form, text="לאיזה תאריך תרצה לרשום את האכילה?", style="Section.TLabel", anchor="e").pack(fill="x")
        date_row = ttk.Frame(form, style="Panel.TFrame")
        date_row.pack(fill="x", pady=(8, 10))
        for text in ("היום", "אתמול", "מותאם אישית"):
            ttk.Radiobutton(
                date_row,
                text=text,
                value=text,
                variable=self.date_choice,
                command=self.update_custom_date_state,
            ).pack(side="right", padx=(8, 0))

        self.custom_entry = ttk.Entry(form, textvariable=self.custom_date, justify="right", state="disabled")
        self.custom_entry.pack(fill="x")
        ttk.Label(form, text="בתאריך מותאם אפשר לכתוב 5/6 או 05/06/2026", style="Hint.TLabel", anchor="e").pack(fill="x", pady=(6, 16))

        ttk.Label(form, text="מה אכלת היום?", style="Section.TLabel", anchor="e").pack(fill="x")
        self.food_text = Text(
            form,
            height=8,
            wrap="word",
            font=self.font_input,
            background="#fbfbfd",
            foreground=TEXT_PRIMARY,
            insertbackground=APPLE_BLUE,
            selectbackground="#cfe8ff",
            selectforeground=TEXT_PRIMARY,
            relief="solid",
            borderwidth=1,
            highlightthickness=1,
            highlightbackground=SEPARATOR,
            highlightcolor=APPLE_BLUE,
            padx=12,
            pady=10,
            undo=True,
        )
        self.food_text.tag_configure("rtl", justify="right", rmargin=4, lmargin1=4, lmargin2=4)
        self.food_text.tag_configure("ltr", justify="left", rmargin=4, lmargin1=4, lmargin2=4)
        self.food_text.tag_add("rtl", "1.0", "end")
        self.food_text.bind("<Return>", self.insert_bullet_line)
        self.food_text.bind("<KP_Enter>", self.insert_bullet_line)
        self.food_text.bind("<KeyPress>", self.insert_rtl_text_character)
        self.food_text.pack(fill="x", pady=(8, 12))

        actions = ttk.Frame(form, style="Panel.TFrame")
        actions.pack(fill="x", pady=(0, 12))
        self.save_button = ttk.Button(actions, text="שמור / עדכן רשומה", style="Primary.TButton", command=self.save_record)
        self.save_button.pack(side="right", padx=(8, 0))
        self.delete_button = ttk.Button(actions, text="מחק רשומה", style="Danger.TButton", command=self.delete_record)
        self.delete_button.pack(side="right", padx=(8, 0))
        self.clear_button = ttk.Button(actions, text="נקה שדות", command=self.clear_form)
        self.clear_button.pack(side="right")
        self.spinner = Canvas(actions, width=28, height=28, background=CARD_BG, highlightthickness=0)
        self.spinner.pack(side="right", padx=(0, 10))
        self.spinner.pack_forget()

        ttk.Label(form, textvariable=self.result_text, style="Panel.TLabel", anchor="e", justify="right", wraplength=460).pack(fill="x", pady=(6, 14))

        details_frame = ttk.Frame(form, style="Panel.TFrame")
        details_frame.pack(fill="both", expand=True)
        ttk.Label(details_frame, text="פירוט הערכה", style="Section.TLabel", anchor="e").pack(fill="x", pady=(0, 8))
        self.items_tree = ttk.Treeview(details_frame, columns=("calories", "confidence", "item"), show="headings", height=7)
        self.items_tree.heading("item", text="פריט")
        self.items_tree.heading("confidence", text="ביטחון")
        self.items_tree.heading("calories", text="קלוריות")
        self.items_tree.column("item", anchor="e", width=260)
        self.items_tree.column("confidence", anchor="center", width=80)
        self.items_tree.column("calories", anchor="center", width=80)
        self.items_tree.pack(fill="both", expand=True)

        dashboard = ttk.Frame(main, style="Card.TFrame", padding=20)
        dashboard.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        dashboard.rowconfigure(2, weight=1)
        dashboard.columnconfigure(0, weight=1)

        top_actions = ttk.Frame(dashboard, style="Panel.TFrame")
        top_actions.grid(row=0, column=0, sticky="ew")
        ttk.Button(top_actions, text="↻", style="Icon.TButton", command=self.refresh_all).pack(side="right")

        graph_controls = ttk.Frame(dashboard, style="Panel.TFrame")
        graph_controls.grid(row=1, column=0, sticky="ew", pady=(14, 8))
        ttk.Label(graph_controls, text="גרף צריכת קלוריות", style="Section.TLabel", anchor="e").pack(side="right", padx=(0, 12))
        for label, value in (("שבוע", "week"), ("חודש", "month"), ("שנה", "year")):
            ttk.Radiobutton(
                graph_controls,
                text=label,
                value=value,
                variable=self.selected_period,
                command=self.draw_graph,
            ).pack(side="right", padx=(8, 0))

        self.graph = Canvas(dashboard, height=270, background=CARD_BG, highlightthickness=1, highlightbackground=SEPARATOR)
        self.graph.grid(row=2, column=0, sticky="nsew", pady=(0, 12))
        self.graph.bind("<Configure>", lambda _event: self.draw_graph())

        self.table_frame = ttk.Frame(dashboard, style="Panel.TFrame")
        self.table_frame.grid(row=3, column=0, sticky="nsew")
        ttk.Label(self.table_frame, text="סיכום לפי ימים", style="Section.TLabel", anchor="e").pack(fill="x", pady=(0, 8))
        self.records_tree = ttk.Treeview(
            self.table_frame,
            columns=("updated", "status", "difference", "calories", "date"),
            show="headings",
            height=9,
        )
        for key, title, width in (
            ("date", "תאריך", 92),
            ("calories", "צריכה", 82),
            ("difference", "פער מהיעד", 94),
            ("status", "מצב", 90),
            ("updated", "עודכן", 142),
        ):
            self.records_tree.heading(key, text=title)
            self.records_tree.column(key, anchor="center", width=width)
        self.records_tree.pack(fill="both", expand=True)
        self.records_tree.bind("<<TreeviewSelect>>", self.load_selected_record)

        storage_note = f"קובץ נתונים: {STORAGE_PATH.name}"
        ttk.Label(dashboard, text=storage_note, style="Hint.TLabel", anchor="e").grid(row=4, column=0, sticky="ew", pady=(8, 0))

    def update_custom_date_state(self) -> None:
        state = "normal" if self.date_choice.get() == "מותאם אישית" else "disabled"
        self.custom_entry.configure(state=state)
        if state == "normal":
            self.custom_entry.focus_set()

    def selected_date_text(self) -> str | None:
        choice = self.date_choice.get()
        raw = self.custom_date.get() if choice == "מותאם אישית" else choice
        parsed = parse_date_text(raw)
        if parsed is None:
            messagebox.showerror(
                "תאריך לא תקין",
                "לא הצלחתי לזהות את התאריך. כתוב בבקשה בפורמט יום/חודש או יום/חודש/שנה.",
            )
            return None
        return format_date(parsed)

    def records(self) -> list[dict]:
        return list(self.state.get("recordsByDate", {}).values())

    def apply_food_text_direction(self, _event=None) -> None:
        insert_index = self.food_text.index("insert")
        self.food_text.tag_remove("ltr", "1.0", "end")
        self.food_text.tag_add("rtl", "1.0", "end")
        self.food_text.mark_set("insert", insert_index)

    def delete_selected_food_text(self) -> None:
        try:
            self.food_text.delete("sel.first", "sel.last")
        except Exception:
            pass

    def insert_rtl_text_character(self, event) -> str | None:
        if not event.char or event.keysym in {"BackSpace", "Delete", "Left", "Right", "Up", "Down", "Home", "End"}:
            return None
        if event.state & 0x4:
            return None

        self.delete_selected_food_text()
        text = event.char
        line_text = strip_bidi_controls(self.food_text.get("insert linestart", "insert lineend"))
        if event.char in NEUTRAL_RTL_CHARS and has_rtl_text(line_text):
            text += RTL_MARK

        self.food_text.insert("insert", text, ("rtl",))
        return "break"

    def insert_bullet_line(self, _event=None) -> str:
        line_start = self.food_text.index("insert linestart")
        line_end = self.food_text.index("insert lineend")
        line_text = self.food_text.get(line_start, line_end)
        clean_line = strip_bidi_controls(line_text).lstrip()

        if clean_line and not clean_line.startswith(BULLET_PREFIX):
            if line_text.startswith(RTL_MARK):
                self.food_text.insert(f"{line_start}+1c", BULLET_PREFIX, ("rtl",))
            else:
                self.food_text.insert(line_start, RTL_MARK + BULLET_PREFIX, ("rtl",))

        self.food_text.insert("insert", "\n" + RTL_MARK + BULLET_PREFIX, ("rtl",))
        self.food_text.tag_add("rtl", "insert linestart", "insert lineend")
        return "break"

    def get_food_text(self) -> str:
        text = strip_bidi_controls(self.food_text.get("1.0", "end-1c"))
        return remove_trailing_empty_bullets(text)

    def set_food_text(self, value: str) -> None:
        self.food_text.delete("1.0", "end")
        self.food_text.insert("1.0", strip_bidi_controls(value), ("rtl",))
        self.apply_food_text_direction()

    def set_loading(self, loading: bool) -> None:
        self.loading = loading
        state = "disabled" if loading else "normal"
        self.save_button.configure(state=state)
        self.delete_button.configure(state=state)
        self.clear_button.configure(state=state)
        self.root.configure(cursor="watch" if loading else "")
        if loading:
            self.spinner_angle = 0
            self.spinner.pack(side="right", padx=(0, 10))
            self.animate_spinner()
        else:
            self.spinner.pack_forget()
            self.spinner.delete("all")

    def animate_spinner(self) -> None:
        if not self.loading:
            return
        self.spinner.delete("all")
        self.spinner.create_oval(5, 5, 23, 23, outline="#e5e5ea", width=3)
        self.spinner.create_arc(
            5,
            5,
            23,
            23,
            start=self.spinner_angle,
            extent=95,
            outline=APPLE_BLUE,
            width=3,
            style="arc",
        )
        self.spinner_angle = (self.spinner_angle - 22) % 360
        self.root.after(45, self.animate_spinner)

    def save_record(self) -> None:
        if self.loading:
            return
        date_text = self.selected_date_text()
        if not date_text:
            return
        food = self.get_food_text()
        if not food:
            messagebox.showwarning("חסר תיאור אוכל", "כתוב בבקשה מה אכלת.")
            return

        existing = self.state["recordsByDate"].get(date_text)
        existing_created_at = existing.get("createdAt") if existing else None
        self.result_text.set("בודק מול ה-API...")
        self.set_loading(True)

        def worker() -> None:
            try:
                record = create_record(date_text, food, existing_created_at)
            except CalorieApiError as exc:
                self.root.after(0, lambda error=exc: self.finish_save_error(error))
            else:
                self.root.after(0, lambda: self.finish_save_success(date_text, record))

        threading.Thread(target=worker, daemon=True).start()

    def finish_save_error(self, error: CalorieApiError) -> None:
        self.set_loading(False)
        messagebox.showerror("שגיאת API", str(error))

    def finish_save_success(self, date_text: str, record: dict) -> None:
        self.set_loading(False)
        self.state["recordsByDate"][date_text] = record
        save_state(self.state)
        self.show_record_result(record)
        self.refresh_all()

    def delete_record(self) -> None:
        date_text = self.selected_date_text()
        if not date_text:
            return
        if date_text not in self.state["recordsByDate"]:
            messagebox.showinfo("אין רשומה", f"לא מצאתי רשומה עבור {date_text}.")
            return
        if not messagebox.askyesno("אישור מחיקה", f"למחוק את הרשומה של {date_text}?"):
            return
        del self.state["recordsByDate"][date_text]
        save_state(self.state)
        self.result_text.set(f"הרשומה של {date_text} נמחקה.\nהממוצע השבועי עודכן.")
        self.clear_items()
        self.refresh_all()

    def clear_form(self) -> None:
        self.food_text.delete("1.0", "end")
        self.custom_date.set("")
        self.date_choice.set("היום")
        self.update_custom_date_state()
        self.result_text.set("בחר תאריך, כתוב מה אכלת ושמור את הרשומה.")
        self.clear_items()

    def clear_items(self) -> None:
        for item_id in self.items_tree.get_children():
            self.items_tree.delete(item_id)

    def show_record_result(self, record: dict) -> None:
        self.clear_items()
        confidence_names = {"high": "גבוה", "medium": "בינוני", "low": "נמוך"}
        for item in record.get("estimatedItems", []):
            self.items_tree.insert(
                "",
                "end",
                values=(
                    number_format(item["estimatedCalories"]),
                    confidence_names.get(item.get("confidence", "medium"), "בינוני"),
                    item["name"],
                ),
            )
        trend = weekly_trend(self.records(), record["date"])
        self.result_text.set(record_message(record, trend))

    def refresh_all(self) -> None:
        self.refresh_table()
        self.draw_graph()

    def refresh_table(self) -> None:
        for item_id in self.records_tree.get_children():
            self.records_tree.delete(item_id)
        for record in sorted(self.records(), key=lambda item: parse_storage_date(item["date"]), reverse=True):
            self.records_tree.insert(
                "",
                "end",
                iid=record["date"],
                values=(
                    record.get("updatedAt", ""),
                    hebrew_status(record["difference"]),
                    number_format(record["difference"]),
                    number_format(record["caloriesConsumed"]),
                    record["date"],
                ),
            )

    def load_selected_record(self, _event=None) -> None:
        selected = self.records_tree.selection()
        if not selected:
            return
        date_text = selected[0]
        record = self.state["recordsByDate"].get(date_text)
        if not record:
            return
        parsed = parse_storage_date(date_text)
        today = today_local()
        if parsed == today:
            self.date_choice.set("היום")
            self.custom_date.set("")
        elif parsed == today - timedelta(days=1):
            self.date_choice.set("אתמול")
            self.custom_date.set("")
        else:
            self.date_choice.set("מותאם אישית")
            self.custom_date.set(date_text)
        self.update_custom_date_state()
        self.set_food_text(record.get("originalFoodText", ""))
        self.show_record_result(record)

    def period_dates(self) -> list[date]:
        now = today_local()
        period = self.selected_period.get()
        if period == "week":
            start, end = week_bounds(now)
            return [start + timedelta(days=index) for index in range((end - start).days + 1)]
        if period == "month":
            start = date(now.year, now.month, 1)
            if now.month == 12:
                next_month = date(now.year + 1, 1, 1)
            else:
                next_month = date(now.year, now.month + 1, 1)
            count = (next_month - start).days
            return [start + timedelta(days=index) for index in range(count)]
        return [date(now.year, month, 1) for month in range(1, 13)]

    def graph_values(self) -> list[tuple[str, int]]:
        records_by_date = self.state.get("recordsByDate", {})
        period = self.selected_period.get()
        values: list[tuple[str, int]] = []
        for day in self.period_dates():
            if period == "year":
                month_total = 0
                for record in records_by_date.values():
                    parsed = parse_storage_date(record["date"])
                    if parsed.year == day.year and parsed.month == day.month:
                        month_total += record["caloriesConsumed"]
                label = f"{day.month:02d}"
                values.append((label, month_total))
            else:
                label = day.strftime("%d/%m")
                record = records_by_date.get(format_date(day))
                values.append((label, record["caloriesConsumed"] if record else 0))
        return values

    def draw_graph(self) -> None:
        self.graph.delete("all")
        width = max(self.graph.winfo_width(), 400)
        height = max(self.graph.winfo_height(), 220)
        pad_left, pad_right, pad_top, pad_bottom = 48, 24, 24, 44
        plot_w = width - pad_left - pad_right
        plot_h = height - pad_top - pad_bottom
        values = self.graph_values()
        if not values:
            return

        max_value = max([value for _, value in values] + [DAILY_CALORIE_TARGET])
        max_axis = int(math.ceil(max_value / 500) * 500) or DAILY_CALORIE_TARGET

        self.graph.create_rectangle(pad_left, pad_top, width - pad_right, height - pad_bottom, outline="#e5e5ea", fill=CARD_BG)
        target_y = pad_top + plot_h - (DAILY_CALORIE_TARGET / max_axis) * plot_h
        self.graph.create_line(pad_left, target_y, width - pad_right, target_y, fill=APPLE_RED, width=2, dash=(6, 4))
        self.graph.create_text(width - pad_right - 4, target_y - 10, text="יעד 2,100", anchor="e", fill=APPLE_RED, font=self.font_graph_label)

        bar_gap = 5
        bar_w = max(6, (plot_w / len(values)) - bar_gap)
        for index, (label, value) in enumerate(values):
            x0 = pad_left + index * (plot_w / len(values)) + bar_gap / 2
            x1 = x0 + bar_w
            bar_h = (value / max_axis) * plot_h if max_axis else 0
            y0 = pad_top + plot_h - bar_h
            color = APPLE_BLUE if value <= DAILY_CALORIE_TARGET else APPLE_ORANGE
            if value == 0:
                color = "#e5e5ea"
            self.graph.create_rectangle(x0, y0, x1, pad_top + plot_h, fill=color, outline="")
            if value:
                self.graph.create_text((x0 + x1) / 2, y0 - 8, text=number_format(value), fill=TEXT_PRIMARY, font=self.font_graph)
            if len(values) <= 12 or index % max(1, len(values) // 8) == 0:
                self.graph.create_text((x0 + x1) / 2, height - pad_bottom + 16, text=label, fill=TEXT_SECONDARY, font=self.font_graph, angle=0)

        for tick in range(0, max_axis + 1, 500):
            y = pad_top + plot_h - (tick / max_axis) * plot_h
            self.graph.create_line(pad_left - 4, y, pad_left, y, fill=SEPARATOR)
            self.graph.create_text(pad_left - 8, y, text=number_format(tick), anchor="e", fill=TEXT_SECONDARY, font=self.font_graph)


def main() -> None:
    root = Tk()
    root.option_add("*Font", "{Segoe UI} 11")
    app = CalorieCounterApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
