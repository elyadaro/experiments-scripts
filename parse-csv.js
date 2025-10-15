const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');

/**
 * מפרק קובץ CSV לפי הדרישות:
 * - שורה ראשונה = כותרות
 * - כל שורה אחרת = אובייקט עם key-value לפי הכותרות
 *
 * @param {string} filePath - נתיב לקובץ CSV
 * @returns {Promise<Array<Object>>} - מערך של אובייקטים
 */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * מפרק קובץ XLSX לפי הדרישות:
 * - שורה ראשונה = כותרות
 * - כל שורה אחרת = אובייקט עם key-value לפי הכותרות
 *
 * @param {string} filePath - נתיב לקובץ XLSX
 * @returns {Promise<Array<Object>>} - מערך של אובייקטים
 */
function parseXLSX(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // הגיליון הראשון
      const worksheet = workbook.Sheets[sheetName];

      // המרה אוטומטית לאובייקטים עם כותרות
      const results = XLSX.utils.sheet_to_json(worksheet);

      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * מפרק קובץ CSV או XLSX בהתאם לסיומת הקובץ
 * - תומך ב: .csv, .xlsx, .xls
 *
 * @param {string} filePath - נתיב לקובץ
 * @returns {Promise<Array<Object>>} - מערך של אובייקטים
 */
async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseXLSX(filePath);
  } else {
    throw new Error(`סוג קובץ לא נתמך: ${ext}. יש להשתמש בקבצי CSV או XLSX`);
  }
}

// דוגמת שימוש
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('שימוש: node parse-csv.js <נתיב-לקובץ>');
    console.error('תומך בפורמטים: CSV, XLSX, XLS');
    process.exit(1);
  }

  try {
    const data = await parseFile(filePath);
    console.log('נמצאו', data.length, 'שורות');
    console.log('דוגמה לשורה ראשונה:', data[0]);
    //console.log('\nכל הנתונים:');
    //console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('שגיאה בקריאת הקובץ:', error.message);
    process.exit(1);
  }
}

// אם מריצים את הקובץ ישירות
if (require.main === module) {
  main();
}

// ייצוא לשימוש כמודול
module.exports = { parseCSV, parseXLSX, parseFile };
