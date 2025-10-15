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

    // כתיבה לקובץ חדש
    const outputPath = path.join(outputDir, fileName);
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
  const currentDir = __dirname;
  const outputDir = path.join(currentDir, 'adapted');

  console.log('=== סקריפט עיבוד קבצי CSV ו-XLSX ===\n');
  console.log(`תיקיית מקור: ${currentDir}`);
  console.log(`תיקיית יעד: ${outputDir}\n`);

  // יצירת תיקיית היעד אם לא קיימת
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log('✓ תיקיית adapted נוצרה\n');
  }

  // מציאת כל קבצי ה-CSV ו-XLSX בתיקייה הנוכחית
  const files = fs.readdirSync(currentDir);
  const dataFiles = files.filter(file => {
    const lowerFile = file.toLowerCase();
    return (lowerFile.endsWith('.csv') || lowerFile.endsWith('.xlsx') || lowerFile.endsWith('.xls')) &&
      fs.statSync(path.join(currentDir, file)).isFile();
  });

  if (dataFiles.length === 0) {
    console.log('לא נמצאו קבצי CSV או XLSX בתיקייה');
    return;
  }

  console.log(`נמצאו ${dataFiles.length} קבצים:\n`);

  // עיבוד כל הקבצים
  for (const dataFile of dataFiles) {
    const filePath = path.join(currentDir, dataFile);
    await processCSVFile(filePath, outputDir);
  }

  console.log('\n=== סיום עיבוד ===');
}

// הרצת הסקריפט
if (require.main === module) {
  main().catch(error => {
    console.error('שגיאה כללית:', error);
    process.exit(1);
  });
}

module.exports = { processCSVFile, processRow, convertGender };
