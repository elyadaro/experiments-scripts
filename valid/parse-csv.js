const fs = require('fs');
const csv = require('csv-parser');

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

// דוגמת שימוש
async function main() {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    console.error('שימוש: node parse-csv.js <נתיב-לקובץ-csv>');
    process.exit(1);
  }

  try {
    const data = await parseCSV(csvFilePath);
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
module.exports = { parseCSV };
