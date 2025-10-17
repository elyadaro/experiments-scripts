const fs = require('fs');
const path = require('path');
const { parseFile } = require('./parse-csv');

/**
 * סקריפט לעיבוד אצווה של קבצי CSV ו-XLSX:
 * - סורק את התיקייה הנוכחית למציאת כל קבצי CSV ו-XLSX
 * - מעבד כל קובץ: מסנן עמודות ומבצע המרות
 * - שומר את הקבצים המעובדים בתיקייה 'adapted'
 */

// כל העמודות לעיבוד ראשוני
const ALL_COLUMNS = [
  'participant',
  'session',
  'age',
  'gender', // יוחלף מהעמודה המקורית
  'faceTesting',
  'race',
  'isFamous',
  'orientation',
  'oldnew',
  'testkeys.keys',
  'testkeys.rt',
  'faceAsking',
  'correctOption',
  'familiarnessKeys.keys'
];

// עמודות לפלט הסופי (רק עמודות faceTesting, בלי עמודות faceAsking)
const OUTPUT_COLUMNS = [
  'participant',
  'session',
  'age',
  'gender',
  'faceTesting',
  'race',
  'isFamous',
  'orientation',
  'oldnew',
  'condition',
  'testkeys.keys',
  'testkeys.rt',
  'HIT_FA',
  'HIT_rt'
];

// עמודות לשורת הסיכום
const SUMMARY_COLUMNS = [
  'participant',
  'session',
  'age',
  'gender',
  'FNC_HIT', 'FNC_FA', 'FNC_m_rt',
  'FNA_HIT', 'FNA_FA', 'FNA_m_rt',
  'FLC_HIT', 'FLC_FA', 'FLC_m_rt',
  'FLA_HIT', 'FLA_FA', 'FLA_m_rt',
  'UNC_HIT', 'UNC_FA', 'UNC_m_rt',
  'UNA_HIT', 'UNA_FA', 'UNA_m_rt',
  'ULC_HIT', 'ULC_FA', 'ULC_m_rt',
  'ULA_HIT', 'ULA_FA', 'ULA_m_rt'
];

/**
 * מזהה את שם עמודת המגדר בקובץ המקורי
 * @param {Object} row - שורה ראשונה מהנתונים
 * @returns {string|null} - שם העמודה או null אם לא נמצאה
 */
function findGenderColumn(row) {
  const possibleNames = ['female="1", male="2"', 'female="1"'];
  for (const name of possibleNames) {
    if (name in row) {
      return name;
    }
  }
  return null;
}

/**
 * ממיר ערך מגדר מספרי לטקסט
 * @param {string|number} value - הערך המקורי
 * @returns {string} - 'female', 'male' או הערך המקורי
 */
function convertGender(value) {
  const strValue = String(value).trim();
  if (strValue === '1') return 'female';
  if (strValue === '2') return 'male';
  return strValue;
}

/**
 * מחשבת את הערך של עמודת HIT_FA
 * @param {Object} row - השורה המעובדת
 * @returns {string} - 'HIT', 'FA' או מחרוזת ריקה
 */
function calculateHitFA(row) {
  if (row['testkeys.keys'] === 'right') {
    if (row.oldnew === 'old') {
      return 'HIT';
    } else if (row.oldnew === 'new') {
      return 'FA';
    }
  }
  return '';
}

/**
 * בונה את עמודת condition מאיחוד של 4 עמודות
 * @param {Object} row - השורה המעובדת
 * @returns {string} - מחרוזת משולבת עם מפריד " | " או מחרוזת ריקה
 */
function buildCondition(row) {
  const parts = [
    row.race || '',
    row.isFamous || '',
    row.orientation || '',
    row.oldnew || ''
  ];

  // מסנן ערכים ריקים ומחבר עם " | "
  const filtered = parts.filter(part => part.trim() !== '');

  return filtered.length > 0 ? filtered.join(' | ') : '';
}

/**
 * מחשבת את הערך של עמודת HIT_rt
 * @param {Object} row - השורה המעובדת
 * @returns {string} - ערך ה-RT אם זה HIT, או מחרוזת ריקה
 */
function calculateHitRT(row) {
  if (row.HIT_FA === 'HIT') {
    return row['testkeys.rt'] || '';
  }
  return '';
}

/**
 * מעבד שורת נתונים אחת
 * @param {Object} row - השורה המקורית
 * @param {string} genderColumn - שם עמודת המגדר במקור
 * @returns {Object} - שורה מעובדת
 */
function processRow(row, genderColumn) {
  const processed = {};

  for (const col of ALL_COLUMNS) {
    if (col === 'gender') {
      // טיפול מיוחד בעמודת המגדר
      if (genderColumn && genderColumn in row) {
        processed.gender = convertGender(row[genderColumn]);
      } else {
        processed.gender = '';
      }
    } else {
      // העתקה רגילה של עמודות אחרות
      processed[col] = col in row ? row[col] : '';
    }
  }

  // חישוב עמודת HIT_FA
  processed.HIT_FA = calculateHitFA(processed);

  // חישוב עמודת condition
  processed.condition = buildCondition(processed);

  // חישוב עמודת HIT_rt
  processed.HIT_rt = calculateHitRT(processed);

  return processed;
}

/**
 * ממיר מערך של אובייקטים למחרוזת CSV עם אפשרות להוספת שורת סיכום
 * @param {Array<Object>} data - המידע
 * @param {Array<string>} columns - רשימת העמודות
 * @param {Object|null} summaryRow - שורת סיכום אופציונלית
 * @param {Array<string>|null} summaryColumns - עמודות עבור שורת הסיכום
 * @returns {string} - מחרוזת CSV
 */
function arrayToCSV(data, columns, summaryRow = null, summaryColumns = null) {
  const lines = [];

  // שורת כותרות
  lines.push(columns.join(','));

  // שורות נתונים
  for (const row of data) {
    const values = columns.map(col => {
      let value = row[col] || '';
      // אם הערך מכיל פסיק, מרכאות או שורה חדשה - עוטפים במרכאות
      if (String(value).match(/[,"\n\r]/)) {
        value = `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(','));
  }

  // אם יש שורת סיכום, מוסיפים אותה
  if (summaryRow && summaryColumns) {
    // שורה ריקה להפרדה
    lines.push('');

    // שורת כותרות לסיכום
    lines.push(summaryColumns.join(','));

    // שורת נתונים לסיכום
    const summaryValues = summaryColumns.map(col => {
      let value = summaryRow[col] || '';
      // אם הערך מכיל פסיק, מרכאות או שורה חדשה - עוטפים במרכאות
      if (String(value).match(/[,"\n\r]/)) {
        value = `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(summaryValues.join(','));
  }

  return lines.join('\n');
}

/**
 * יוצר קוד תנאי (FNC, FLC, UNA וכו')
 * @param {string} isFamous - 'famous' או 'unknown'
 * @param {string} orientation - 'normal' או 'flipped'
 * @param {string} race - 'caucasian' או 'afrikan'
 * @returns {string} - קוד התנאי (3 אותיות)
 */
function getConditionCode(isFamous, orientation, race) {
  const famousCode = isFamous === 'famous' ? 'F' : 'U';
  const orientationCode = orientation === 'flipped' ? 'L' : 'N';
  const raceCode = race === 'caucasian' ? 'C' : 'A';

  return famousCode + orientationCode + raceCode;
}

/**
 * מחשבת סטטיסטיקות עבור קומבינציה של תנאים
 * @param {Array<Object>} data - כל השורות של הנבדק (רק faceTesting)
 * @param {string} race - ערך race
 * @param {string} isFamous - ערך isFamous
 * @param {string} orientation - ערך orientation
 * @returns {Object} - {HIT: string, FA: string, m_rt: string}
 */
function calculateConditionStats(data, race, isFamous, orientation) {
  // סינון שורות לפי התנאים
  const conditionRows = data.filter(row =>
    row.race === race &&
    row.isFamous === isFamous &&
    row.orientation === orientation
  );

  if (conditionRows.length === 0) {
    return { HIT: '', FA: '', m_rt: '' };
  }

  // חישוב HIT: מתוך שורות old, כמה 'right'
  const oldRows = conditionRows.filter(row => row.oldnew === 'old');
  const hitCount = oldRows.filter(row => row['testkeys.keys'] === 'right').length;
  const hitRate = oldRows.length > 0 ? (hitCount / oldRows.length).toFixed(2) : '';

  // חישוב FA: מתוך שורות new, כמה 'right'
  const newRows = conditionRows.filter(row => row.oldnew === 'new');
  const faCount = newRows.filter(row => row['testkeys.keys'] === 'right').length;
  const faRate = newRows.length > 0 ? (faCount / newRows.length).toFixed(2) : '';

  // חישוב ממוצע RT רק עבור HITs
  const hitRows = conditionRows.filter(row => row.HIT_FA === 'HIT');
  let meanRT = '';
  if (hitRows.length > 0) {
    const rtValues = hitRows
      .map(row => parseFloat(row['testkeys.rt']))
      .filter(val => !isNaN(val));

    if (rtValues.length > 0) {
      const sum = rtValues.reduce((acc, val) => acc + val, 0);
      meanRT = (sum / rtValues.length).toFixed(2);
    }
  }

  return {
    HIT: hitRate,
    FA: faRate,
    m_rt: meanRT
  };
}

/**
 * בונה שורת סיכום לנבדק
 * @param {Array<Object>} data - כל השורות המסוננות של הנבדק (רק faceTesting)
 * @returns {Object} - אובייקט עם כל הנתונים הדמוגרפיים והסטטיסטיקות
 */
function buildSummaryRow(data) {
  if (data.length === 0) {
    return {};
  }

  // נתונים דמוגרפיים מהשורה הראשונה
  const firstRow = data[0];
  const summaryRow = {
    participant: firstRow.participant || '',
    session: firstRow.session || '',
    age: firstRow.age || '',
    gender: firstRow.gender || ''
  };

  // רשימת כל הקומבינציות: isFamous × orientation × race
  const famousValues = ['famous', 'unknown'];
  const orientationValues = ['normal', 'flipped'];
  const raceValues = ['caucasian', 'afrikan'];

  // חישוב סטטיסטיקות עבור כל קומבינציה
  for (const isFamous of famousValues) {
    for (const orientation of orientationValues) {
      for (const race of raceValues) {
        const code = getConditionCode(isFamous, orientation, race);
        const stats = calculateConditionStats(data, race, isFamous, orientation);

        summaryRow[`${code}_HIT`] = stats.HIT;
        summaryRow[`${code}_FA`] = stats.FA;
        summaryRow[`${code}_m_rt`] = stats.m_rt;
      }
    }
  }

  return summaryRow;
}

/**
 * מסיר את כל שורות faceAsking מהנתונים
 * @param {Array<Object>} data - המידע המעובד
 * @returns {Array<Object>} - נתונים מסוננים (רק שורות faceTesting)
 */
function removeFaceAskingRows(data) {
  const filteredData = data.filter(row => row.faceTesting || row.faceTesting !== '');

  const removedCount = data.length - filteredData.length;
  if (removedCount > 0) {
    console.log(`  → הוסרו ${removedCount} שורות faceAsking`);
  }

  return filteredData;
}

/**
 * מסיר שורות של תמונות מפורסמות שהנבדק לא הכיר
 * @param {Array<Object>} data - המידע המעובד
 * @returns {Array<Object>} - נתונים מסוננים
 */
function removeUnrecognizedFamous(data) {
  // שלב 1: בניית מיפוי של תמונות מפורסמות מתוך שורות faceTesting
  const famousImages = new Set();
  for (const row of data) {
    if (row.faceTesting && row.isFamous === 'famous') {
      famousImages.add(row.faceTesting);
    }
  }

  // שלב 2: בניית מיפוי של תמונות שהנבדק לא הכיר (familiarnessKeys.keys = "4")
  const unrecognizedImages = new Set();
  for (const row of data) {
    if (row.faceAsking && row['familiarnessKeys.keys'] === '4') {
      unrecognizedImages.add(row.faceAsking);
    }
  }

  // שלב 3: מציאת תמונות שהן גם מפורסמות וגם לא הוכרו
  const imagesToRemove = new Set();
  for (const image of famousImages) {
    if (unrecognizedImages.has(image)) {
      imagesToRemove.add(image);
    }
  }

  // שלב 4: סינון השורות - הסרת כל השורות (faceTesting ו-faceAsking) של תמונות אלו
  const filteredData = data.filter(row => {
    const imageName = row.faceTesting || row.faceAsking;
    return !imageName || !imagesToRemove.has(imageName);
  });

  const removedCount = data.length - filteredData.length;
  if (removedCount > 0) {
    console.log(`  → הוסרו ${removedCount} שורות של ${imagesToRemove.size} תמונות מפורסמות שלא הוכרו`);
  }

  return filteredData;
}

/**
 * יוצר שם קובץ בפורמט: {participant}_{gender}-{session}.csv
 * @param {Object} firstRow - השורה הראשונה מהנתונים המעובדים
 * @param {string} originalFileName - שם הקובץ המקורי (לשימוש כ-fallback)
 * @returns {string} - שם הקובץ
 */
function generateOutputFileName(firstRow, originalFileName) {
  try {
    const participant = firstRow.participant || '';
    const gender = firstRow.gender || '';
    const session = firstRow.session || '';

    if (participant && gender && session) {
      return `${participant}_${gender}-${session}.csv`;
    } else {
      console.log(`  ⚠ חסרים שדות לשם הקובץ (participant: ${participant}, gender: ${gender}, session: ${session})`);
      console.log(`  → משתמש בשם המקורי`);
      const fileNameWithoutExt = path.basename(originalFileName, path.extname(originalFileName));
      return `${fileNameWithoutExt}.csv`;
    }
  } catch (error) {
    console.log(`  ⚠ שגיאה ביצירת שם קובץ, משתמש בשם המקורי`);
    const fileNameWithoutExt = path.basename(originalFileName, path.extname(originalFileName));
    return `${fileNameWithoutExt}.csv`;
  }
}

/**
 * מעבד קובץ CSV או XLSX בודד
 * @param {string} filePath - נתיב לקובץ המקור
 * @param {string} outputDir - תיקיית היעד
 */
async function processCSVFile(filePath, outputDir) {
  const fileName = path.basename(filePath);
  console.log(`מעבד: ${fileName}`);

  try {
    // פרסור הקובץ המקורי (תומך ב-CSV, XLSX, XLS)
    const data = await parseFile(filePath);

    if (data.length === 0) {
      console.log(`  ⚠ הקובץ ריק, מדלג`);
      return;
    }

    // זיהוי עמודת המגדר
    const genderColumn = findGenderColumn(data[0]);
    if (!genderColumn) {
      console.log(`  ⚠ לא נמצאה עמודת מגדר, ממשיך בלי המרה`);
    }

    // עיבוד כל השורות
    const processedData = data.map(row => processRow(row, genderColumn));

    // סינון תמונות מפורסמות שלא הוכרו
    let filteredData = removeUnrecognizedFamous(processedData);

    // הסרת כל שורות faceAsking (נשארות רק שורות faceTesting)
    filteredData = removeFaceAskingRows(filteredData);

    // חישוב שורת סיכום
    const summaryRow = buildSummaryRow(filteredData);

    // המרה ל-CSV (רק עם עמודות הפלט, בלי עמודות faceAsking) + שורת סיכום
    const csvContent = arrayToCSV(filteredData, OUTPUT_COLUMNS, summaryRow, SUMMARY_COLUMNS);

    // יצירת שם קובץ פלט בפורמט: {participant}_{gender}-{session}.csv
    const outputFileName = generateOutputFileName(filteredData[0], fileName);
    const outputPath = path.join(outputDir, outputFileName);

    // כתיבה לקובץ חדש
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`  ✓ נשמר ב: ${outputPath} (${filteredData.length} שורות)`);

  } catch (error) {
    console.error(`  ✗ שגיאה בעיבוד ${fileName}:`, error.message);
  }
}

/**
 * פונקציה ראשית
 */
async function main() {
  // קבלת נתיב תיקייה מ-CLI או שימוש בתיקייה הנוכחית
  const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
  const outputDir = path.join(inputDir, 'adapted');

  console.log('=== סקריפט עיבוד קבצי CSV ו-XLSX ===\n');
  console.log(`תיקיית מקור: ${inputDir}`);
  console.log(`תיקיית יעד: ${outputDir}\n`);

  // בדיקה שתיקיית המקור קיימת
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ שגיאה: התיקייה ${inputDir} לא קיימת`);
    process.exit(1);
  }

  if (!fs.statSync(inputDir).isDirectory()) {
    console.error(`❌ שגיאה: ${inputDir} אינה תיקייה`);
    process.exit(1);
  }

  // יצירת תיקיית היעד אם לא קיימת
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log('✓ תיקיית adapted נוצרה\n');
  }

  // מציאת כל קבצי ה-CSV ו-XLSX בתיקייה
  const files = fs.readdirSync(inputDir);
  const dataFiles = files.filter(file => {
    const lowerFile = file.toLowerCase();
    return (lowerFile.endsWith('.csv') || lowerFile.endsWith('.xlsx') || lowerFile.endsWith('.xls')) &&
      fs.statSync(path.join(inputDir, file)).isFile();
  });

  if (dataFiles.length === 0) {
    console.log('לא נמצאו קבצי CSV או XLSX בתיקייה');
    return;
  }

  console.log(`נמצאו ${dataFiles.length} קבצים:\n`);

  // עיבוד כל הקבצים
  for (const dataFile of dataFiles) {
    const filePath = path.join(inputDir, dataFile);
    await processCSVFile(filePath, outputDir);
  }

  console.log('\n=== סיום עיבוד ===');
}

// הרצת הסקריפט
if (require.main === module) {
  // הצגת הוראות שימוש
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('שימוש: node process-csv-batch.js [נתיב-לתיקייה]');
    console.log('\nאפשרויות:');
    console.log('  נתיב-לתיקייה    תיקייה המכילה קבצי CSV/XLSX לעיבוד (ברירת מחדל: תיקייה נוכחית)');
    console.log('  -h, --help       הצגת הוראות שימוש');
    console.log('\nדוגמאות:');
    console.log('  node process-csv-batch.js');
    console.log('  node process-csv-batch.js ./data');
    console.log('  node process-csv-batch.js C:\\Users\\myuser\\Documents\\data');
    process.exit(0);
  }

  main().catch(error => {
    console.error('שגיאה כללית:', error);
    process.exit(1);
  });
}

module.exports = { processCSVFile, processRow, convertGender, removeUnrecognizedFamous, removeFaceAskingRows };
