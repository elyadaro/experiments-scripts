const fs = require('fs');
const path = require('path');
const { parseFile } = require('./parse-csv');

/**
 * סקריפט לעיבוד אצווה של קבצי CSV ו-XLSX:
 * - סורק את התיקייה הנוכחית למציאת כל קבצי CSV ו-XLSX
 * - מעבד כל קובץ: מסנן עמודות ומבצע המרות
 * - שומר את הקבצים המעובדים בתיקייה 'adapted'
 */

// רשימת העמודות המבוקשות לפי הסדר
const REQUIRED_COLUMNS = [
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
 * מעבד שורת נתונים אחת
 * @param {Object} row - השורה המקורית
 * @param {string} genderColumn - שם עמודת המגדר במקור
 * @returns {Object} - שורה מעובדת
 */
function processRow(row, genderColumn) {
  const processed = {};

  for (const col of REQUIRED_COLUMNS) {
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

  return processed;
}

/**
 * ממיר מערך של אובייקטים למחרוזת CSV
 * @param {Array<Object>} data - המידע
 * @param {Array<string>} columns - רשימת העמודות
 * @returns {string} - מחרוזת CSV
 */
function arrayToCSV(data, columns) {
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

  return lines.join('\n');
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

    // המרה ל-CSV
    const csvContent = arrayToCSV(processedData, REQUIRED_COLUMNS);

    // יצירת שם קובץ פלט בפורמט: {participant}_{gender}-{session}.csv
    const outputFileName = generateOutputFileName(processedData[0], fileName);
    const outputPath = path.join(outputDir, outputFileName);

    // כתיבה לקובץ חדש
    fs.writeFileSync(outputPath, csvContent, 'utf8');

    console.log(`  ✓ נשמר ב: ${outputPath} (${processedData.length} שורות)`);

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

module.exports = { processCSVFile, processRow, convertGender };
