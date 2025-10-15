const { parseCSV } = require('./parse-csv');

/**
 * משווה שני אובייקטים ומחזיר את השדות השונים
 * @param {Object} obj1 - אובייקט ראשון
 * @param {Object} obj2 - אובייקט שני
 * @returns {Array<Object>} - מערך של ההבדלים
 */
function findDifferences(obj1, obj2) {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    if (obj1[key] !== obj2[key]) {
      differences.push({
        field: key,
        file1: obj1[key] || '(חסר)',
        file2: obj2[key] || '(חסר)'
      });
    }
  }

  return differences;
}

/**
 * משווה את 75 השורות הראשונות של שני קבצי CSV
 * @param {string} filePath1 - נתיב לקובץ CSV ראשון
 * @param {string} filePath2 - נתיב לקובץ CSV שני
 */
async function compareCSVFiles(filePath1, filePath2) {
  try {
    console.log('קורא את הקבצים...\n');

    // קריאת שני הקבצים
    const data1 = await parseCSV(filePath1);
    const data2 = await parseCSV(filePath2);

    // לוקח רק 75 שורות ראשונות
    const rows1 = data1.slice(0, 75);
    const rows2 = data2.slice(0, 75);

    console.log(`קובץ 1: ${rows1.length} שורות (מתוך ${data1.length})`);
    console.log(`קובץ 2: ${rows2.length} שורות (מתוך ${data2.length})\n`);

    // בדיקת אורך
    if (rows1.length !== rows2.length) {
      console.log('⚠️  אזהרה: מספר השורות שונה בין הקבצים!');
      console.log(`קובץ 1: ${rows1.length} שורות`);
      console.log(`קובץ 2: ${rows2.length} שורות\n`);
    }

    // השוואת שורות
    const differingRows = [];
    const maxRows = Math.max(rows1.length, rows2.length);

    for (let i = 0; i < maxRows; i++) {
      const row1 = rows1[i];
      const row2 = rows2[i];

      if (!row1 || !row2) {
        differingRows.push({
          rowNumber: i + 1,
          reason: 'שורה חסרה באחד הקבצים',
          differences: []
        });
      } else {
        const differences = findDifferences(row1, row2);
        if (differences.length > 0) {
          differingRows.push({
            rowNumber: i + 1,
            differences: differences
          });
        }
      }
    }

    // הצגת תוצאות
    if (differingRows.length === 0) {
      console.log('✅ 75 השורות הראשונות זהות בשני הקבצים!');
    } else {
      console.log(`❌ נמצאו ${differingRows.length} שורות שונות:\n`);
      console.log('='.repeat(80));

      differingRows.forEach(({ rowNumber, reason, differences }) => {
        console.log(`\nשורה ${rowNumber}:`);

        if (reason) {
          console.log(`  ${reason}`);
        } else {
          differences.forEach(({ field, file1, file2 }) => {
            console.log(`  שדה: ${field}`);
            console.log(`    קובץ 1: ${file1}`);
            console.log(`    קובץ 2: ${file2}`);
          });
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log(`סה"כ: ${differingRows.length} שורות שונות מתוך ${Math.min(rows1.length, rows2.length)}`);
    }

  } catch (error) {
    console.error('שגיאה:', error.message);
    process.exit(1);
  }
}

// דוגמת שימוש
async function main() {
  const filePath1 = process.argv[2];
  const filePath2 = process.argv[3];

  if (!filePath1 || !filePath2) {
    console.error('שימוש: node compare-csv.js <קובץ-csv-1> <קובץ-csv-2>');
    process.exit(1);
  }

  await compareCSVFiles(filePath1, filePath2);
}

// אם מריצים את הקובץ ישירות
if (require.main === module) {
  main();
}

module.exports = { compareCSVFiles };
