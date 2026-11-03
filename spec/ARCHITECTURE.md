# WIZEROLL · ARCHITECTURE

**עידו מסיקה** · קורס מיישם AI ואוטומציה 53500 · גרסה 1, 14.10.2026

נגזר מ-`PRD.md` (גרסה 1), `tech-stack.md` (גרסה 1), `course-stack.md` (8.10.2026) ו-`product-10-definitions.md` (גרסה 3). לא נמצאה סתירה בין המסמכים, ולכן אין נקודה לאישור לפני הכתיבה.

---

## 1. מבנה המערכת, שלוש שכבות

### צד לקוח (Frontend), אתר סטטי ב-GitHub Pages

שלושה דפים, לפי `PRD.md` סעיף 3:

- **`index.html`**, עמוד המוצר. תמונות, תצוגת 360 מעלות (`js-cloudimage-360-view`), סרטון מוטמע (`iframe` ל-`YouTube Unlisted`), מפרט תמציתי, ושני כפתורי כניסה ליועץ.
- **`advisor.html`**, השיחה עם היועץ. שני המסלולים באותו דף. קורא ישירות ל-`Supabase` (מפתח ציבורי) לשליפת `product_specs` ו-`faults`, וקורא לפונקציית `Vercel` לכל פנייה למודל.
- **`dashboard.html`**, לוח הפניות הפנימי. מוגן בהתחברות `Supabase Auth`. קורא וכותב ל-`Supabase` ישירות, לפי הרשאות שורה (`RLS`).

הדפים חולקים קובצי `CSS`/`JS` משותפים. אין `framework` ואין שלב בנייה, כנדרש ב-`course-stack.md`.

### לוגיקה (Backend), פונקציית Vercel יחידה

פונקציה אחת, `api/advise.js`, בכתובת `/api/advise`. זהו `proxy` דק לקריאות למודל בלבד, בלי גישה ל-`Supabase` ובלי `state`. כל השוואה מספרית וכל קריאה או כתיבה לנתונים נעשות בקוד הדפדפן ובמפתח הציבורי של `Supabase`, לפי הסעיף הבא.

**למה פונקציה אחת מספיקה:** `course-stack.md` קובע "מתחילים מפונקציה אחת, פונקציה נוספת רק כשדרישה מסוג Must מחייבת אותה". אין ב-`PRD` דרישת `Must` שמחייבת פונקציה שנייה; כל שאר התקשורת עוברת דרך `Supabase` (המפתח הציבורי שלה מותר בדפדפן) או דרך `n8n` (פועל בנפרד, לא מול הדפדפן).

**הפרדת התפקידים בתוך הקריאה למודל**, לפי `PRD.md` סעיף 10: הפונקציה מקבלת פרמטר `task` שערכו אחד משלושה:

1. `extract`, מסלול א: קלט חופשי מהלקוח. מחזירה את הנתונים שחולצו ורשימת מה שחסר.
2. `classify`, מסלול ב: תסמין בחופשי + רשימת תסמינים מטבלת `faults` (בלי פתרונות). מחזירה `fault_id` משוער ורמת ביטחון.
3. `phrase`, שני המסלולים: תוצאת ההשוואה או הסיווג, שכבר חושבה בקוד. מחזירה ניסוח בעברית, לפי שלוש המגבלות שב-`PRD.md` סעיף 10.

הפונקציה אינה מקבלת לעולם את טווחי `product_specs` או את טקסט הפתרון מ-`faults`, כדי שההחלטה העסקית תישאר בקוד הנבדק, לא במודל.

### נתונים (Data), Supabase

שלוש טבלאות: `product_specs`, `faults`, `requests`. פורטות בסעיף הבא. הרשאות הטבלה (`RLS`) הן שכבת ההגנה היחידה, לפי `course-stack.md`: "ההגנה היא בהרשאות הטבלה, לא בהסתרת הדף".

---

## 2. מבנה הנתונים

### `product_specs`

כל שורה היא כלל התאמה אחד, כתוב במונחי הלקוח.

| שדה | סוג | תיאור |
|---|---|---|
| `id` | `uuid`, `PK` | מזהה |
| `field_key` | `text`, ייחודי | מזהה פנימי לשדה, למשל `desk_height_cm` |
| `customer_label_template` | `text` | משפט בעברית עם מקומות ל-`{min}`/`{max}`/`{values}`, למשל "מתאים לשולחן בגובה {min} עד {max} ס״מ" |
| `value_type` | `text` | `numeric_range` או `categorical` |
| `min_value` | `numeric`, יכול להיות ריק | לטווח מספרי |
| `max_value` | `numeric`, יכול להיות ריק | לטווח מספרי |
| `allowed_values` | `jsonb`, יכול להיות ריק | לערכים קטגוריאליים, למשל סוגי רצפה |
| `created_at` | `timestamptz` | ברירת מחדל `now()` |

שורות לדוגמה (לפי השדות שמופיעים ב-`PRD.md` סעיף 9): גובה שולחן, גובה הלקוח, משקל, שעות ישיבה, סוג רצפה, אופן ישיבה. שש שורות, מעל המינימום של חמש שדרוש ב-`course-stack.md`.

### `faults`

| שדה | סוג | תיאור |
|---|---|---|
| `id` | `uuid`, `PK` | מזהה |
| `symptom_he` | `text` | התסמין, כפי שמוצג למודל לצורך סיווג |
| `likely_cause_he` | `text`, יכול להיות ריק | סיבה אפשרית |
| `fix_instructions_he` | `text` | הנחיית התיקון, מוצגת ללקוח רק אחרי שהקוד זיהה את השורה, לא נשלחת למודל |
| `self_fixable` | `boolean` | האם ניתן לתיקון עצמי |
| `created_at` | `timestamptz` | ברירת מחדל `now()` |

כעשר שורות דמה, כנדרש ב-`PRD.md`.

### `requests`

טבלה אחת לשני סוגי הפנייה, עם עמודת סוג, כפי שהוכרע ב-`MVP.md`.

| שדה | סוג | תיאור |
|---|---|---|
| `id` | `uuid`, `PK` | מזהה |
| `request_type` | `text` | `fit_check` או `service` |
| `customer_email` | `text` | כתובת הלקוח |
| `conversation_log` | `jsonb` | מערך הודעות השיחה: `{role, text, at}` |
| `extracted_fields` | `jsonb`, רלוונטי ל-`fit_check` | הנתונים שחולצו מהלקוח |
| `verdict` | `text`, רלוונטי ל-`fit_check` | `fit` / `fit_with_reservation` / `not_fit` |
| `verdict_field_key` | `text`, רלוונטי ל-`fit_check` | `field_key` מ-`product_specs` שקבע את התשובה |
| `wants_order` | `boolean`, ברירת מחדל `false`, רלוונטי ל-`fit_check` | סימון "רוצה להזמין" |
| `reminder_sent` | `boolean`, ברירת מחדל `false`, רלוונטי ל-`fit_check` | מונע תזכורת כפולה (פיצ'ר `Should` 27) |
| `matched_fault_id` | `uuid`, `FK` ל-`faults.id`, יכול להיות ריק, רלוונטי ל-`service` | התקלה שזוהתה |
| `fault_match_confidence` | `text`, רלוונטי ל-`service` | `high` / `low` / `not_identified` |
| `status` | `text` | ל-`fit_check`: `recorded`. ל-`service`: `resolved` / `pending` / `approved` / `rejected` |
| `owner_decision` | `text`, יכול להיות ריק, רלוונטי ל-`service` | `replacement` / `credit` / `special_quote` |
| `owner_decision_note` | `text`, יכול להיות ריק | הערת בעל העסק להחלטה |
| `escalation_sent` | `boolean`, ברירת מחדל `false`, רלוונטי ל-`service` | מונע תזכורת כפולה (פיצ'ר `Should` 28) |
| `created_at` | `timestamptz` | ברירת מחדל `now()` |
| `updated_at` | `timestamptz` | מתעדכן בכל שינוי סטטוס |

**הנחה:** `reminder_sent` ו-`escalation_sent` אינן מופיעות במפורש ב-`PRD`, אבל בלעדיהן האוטומציה המתוזמנת (פיצ'רים 27, 28) תשלח את אותה תזכורת בכל הרצה יומית. שתי עמודות `boolean` הן הדרך הפשוטה ביותר למנוע כפילות.

**קשרים:** `requests.matched_fault_id → faults.id`, יחיד ואופציונלי. אין קשר בין `product_specs` ל-`faults`.

---

## 3. התחברות והרשאות

לפי `product-10-definitions.md` סעיף 8 ו-`course-stack.md`, רמת הרשאה 1: משתמש אחד, בעל העסק, נוצר ידנית בדשבורד של `Supabase Auth` (מייל וסיסמה). אין הרשמה עצמית, אין שחזור סיסמה ואין כניסה עם `Google`, בכל הרמות.

`dashboard.html` מציג טופס כניסה בלבד, קורא ל-`supabase.auth.signInWithPassword()`. `session token` מנוהל על ידי ספריית `supabase-js` בדפדפן, כמקובל; זה אסימון התחברות, לא זיכרון המערכת, ולכן אינו סותר את כלל ה-`localStorage` ב-`course-stack.md`.

**הרשאות לפי טבלה (`RLS`):**

| טבלה | `anon` (לקוח) | `authenticated` (בעל העסק) |
|---|---|---|
| `product_specs` | קריאה בלבד (המפרט פומבי ממילא) | קריאה, הוספה, עדכון, מחיקה |
| `faults` | אין גישה | קריאה, הוספה, עדכון, מחיקה |
| `requests` | הוספה בלבד, בלי קריאה | קריאה, עדכון |

`faults` חסומה מ-`anon` לגמרי: הלקוח אינו אמור לקרוא את רשימת התקלות והפתרונות ישירות, רק לקבל תוצאה אחת מהיועץ. `product_specs` פתוחה לקריאה כי היא זהה למפרט המוצג בעמוד המוצר.

הלקוח האנונימי יכול לכתוב פנייה חדשה, ולא יכול לקרוא פניות של אחרים, בדיוק לפי `course-stack.md`.

---

## 4. שכבת ה-AI

**מודל:** `Gemini 3.8 Flash`, בשכבה החינמית, לפי `tech-stack.md`.

**מה נשלח למודל, לפי `task`:**

- `extract`: טקסט חופשי של הלקוח + רשימת `field_key` ו-`customer_label_template` (בלי `min`/`max`/`allowed_values`) כדי שהמודל ידע מה לחפש, בלי לדעת מה הטווח התקין.
- `classify`: תסמין בחופשי + מערך `{id, symptom_he}` מכל שורות `faults` (בלי `fix_instructions_he` ובלי `self_fixable`).
- `phrase`: תוצאת ההשוואה/הסיווג שכבר חושבה בקוד (קטגוריה, השדה שקבע אותה, הערך שהלקוח נתן, הערך התקין), בשביל ניסוח בלבד.

**מה חוזר:** תשובה ב-`JSON` קשיח לפי `schema` (באמצעות `structured output` של `Gemini`, ראו `tech-stack.md`):

- `extract` מחזירה: `{extracted: {field_key: value, ...}, missing: [field_key, ...]}`
- `classify` מחזירה: `{matched_fault_id, confidence}` או `{matched_fault_id: null, confidence: "not_identified"}`
- `phrase` מחזירה: `{reply_text}`

הקוד (בדפדפן) בודק שה-`JSON` תקין לפני שהוא משתמש בו, לפי `course-stack.md`.

**דרך הקריאה:** `advisor.html` → `fetch` ל-`/api/advise` (פונקציית `Vercel`) → הפונקציה קוראת ל-`Gemini API` עם המפתח הסודי ממשתני הסביבה → מחזירה `JSON` לדפדפן. הדפדפן אף פעם לא קורא ל-`Gemini` ישירות. הפונקציה מגבילה את אורך הטקסט החופשי שהיא מעבירה הלאה (עד 2,000 תווים; **הנחה**, `course-stack.md` דורש הגבלה בלי לקבוע מספר).

שלוש מגבלות הפרומפט (אין להמציא מפרט, אין להתחייב בשם העסק, אין המלצה רפואית) חיות בפרומפט של `task=phrase`, כי שם המודל מנסח טקסט פונה ללקוח.

---

## 5. אינטגרציות, APIs ואוטומציות

**שליחה מהדפדפן ל-`Supabase`:** ספריית `supabase-js`, עם כתובת הפרויקט והמפתח הציבורי, קריאה וכתיבה ישירות, מוגנת ב-`RLS` (סעיף 3).

**שליחה מהדפדפן לפונקציה:** `fetch('/api/advise', {method:'POST', body: JSON.stringify({task, ...})})`, רק לשלושת סוגי ה-`task` שבסעיף 4.

**הפעלת האוטומציות:** דרך `Supabase Database Webhooks` (תכונה מובנית של `Supabase`, לא שירות חיצוני נוסף), לא דרך קריאה ישירה מהדפדפן ל-`n8n`:

- `Webhook` על `INSERT` לטבלת `requests` → `n8n`: מפצל לפי `request_type`. ל-`fit_check` שולח מייל ללקוח עם תשובת ההתאמה (פיצ'ר 25). ל-`service` שולח מייל ללקוח ("ממתין לטיפול") והתראה לבעל העסק (פיצ'ר 26).
- `Webhook` על `UPDATE` לטבלת `requests`, כש-`owner_decision` משתנה מריק לערך → `n8n`: שולח ללקוח מייל עם ההחלטה (פיצ'ר 29, `Should`).
- `Schedule Trigger` יומי ב-`n8n` → שולף מ-`Supabase` פניות `fit_check` עם `wants_order=false`, `reminder_sent=false` ו-`created_at` ישן מ-3 ימים (לפי ההנחה ב-`PRD.md`) → שולח תזכורת, ומעדכן `reminder_sent=true` (פיצ'ר 27, `Should`).
- `Schedule Trigger` יומי נוסף → שולף פניות `service` עם `status=pending`, `escalation_sent=false` ו-`created_at` ישן מיומיים → שולח התראה לבעל העסק, ומעדכן `escalation_sent=true` (פיצ'ר 28, `Should`).

כל שליחת מייל דרך `n8n` וחשבון `Gmail` של הסטודנט, לכתובות בדיקה בלבד, לפי `course-stack.md`.

---

## 6. מפתחות API, ומה אסור שיגיע לדפדפן

| מפתח | מיקום | מי משתמש בו |
|---|---|---|
| `GEMINI_API_KEY` | משתנה סביבה סודי בפרויקט `Vercel` | רק `api/advise.js` |
| מפתח `Supabase` ציבורי (`anon key`) + כתובת הפרויקט | קוד הדפדפן, גלוי (זהו היוצא מן הכלל לפי `course-stack.md`) | כל הדפים, מוגן ב-`RLS` |
| פרטי התחברות בעל העסק | נשמרים מוצפנים בתוך `Supabase Auth`, לא בקוד | `dashboard.html`, דרך `supabase.auth` |
| אישורי `Gmail` ל-`n8n` | `Credentials` של `n8n` בלבד | `workflows` ב-`n8n` |
| כתובת `Supabase Database Webhook` | מוגדרת בהגדרות הפרויקט ב-`Supabase`, לא בריפו | `Supabase` → `n8n` |

**לא נשתמש ב-`Supabase service role key` בפרויקט הזה.** הפונקציה `api/advise.js` אינה נוגעת ב-`Supabase` כלל, ולכן אין צורך במפתח המחייב הרשאות מלאות. הדפדפן עובד תמיד עם המפתח הציבורי בלבד, מוגן בהרשאות הטבלה.

אסור שיגיעו לדפדפן: `GEMINI_API_KEY`, פרטי ה-`Credentials` של `n8n`, וכל מפתח שאינו המפתח הציבורי של `Supabase`.

---

## 7. מבנה התיקיות

```
/
├── index.html              # עמוד מוצר
├── advisor.html             # שיחה עם היועץ
├── dashboard.html            # לוח פניות, מוגן בהתחברות
├── css/
│   ├── base.css              # RTL, טיפוגרפיה, נגישות, מובייל קודם
│   ├── product.css
│   ├── advisor.css
│   └── dashboard.css
├── js/
│   ├── supabase-client.js    # אתחול supabase-js עם המפתח הציבורי
│   ├── product.js            # לוגיקת עמוד המוצר, אתחול תצוגת 360
│   ├── advisor.js            # שתי המסלולים: שליפת specs/faults, קריאות ל-/api/advise, השוואה בקוד, כתיבת requests
│   ├── dashboard.js           # התחברות, שליפת פניות, אישור/דחייה, עדכון סטטוס
│   └── shared.js             # עזרי ממשק משותפים
├── api/
│   └── advise.js             # פונקציית Vercel היחידה, קריאה ל-Gemini בלבד
├── ai-tests.md               # עשרה קלטי דמה לפחות, התוצאה הצפויה, ואחוז הצלחה
├── package.json               # "type": "module"
└── .gitignore                 # כולל .env
```

קובץ `.env` מקומי בלבד (לא בריפו), עם `GEMINI_API_KEY` לפיתוח. בייצור המפתח מוגדר כמשתנה סביבה ב-`Vercel`.
