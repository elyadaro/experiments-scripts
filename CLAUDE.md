# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js utility repository for CSV and XLSX file processing and comparison. The codebase contains three main scripts written in JavaScript with Hebrew comments and console output.

## Core Scripts

### 1. parse-csv.js - File Parsing Module
The foundational parsing module that provides:
- `parseCSV(filePath)`: Parses CSV files using the csv-parser library
- `parseXLSX(filePath)`: Parses XLSX/XLS files using the xlsx library
- `parseFile(filePath)`: Auto-detects file type (.csv, .xlsx, .xls) and parses accordingly

All functions return `Promise<Array<Object>>` where the first row is treated as headers and subsequent rows are objects with key-value pairs based on those headers.

### 2. compare-csv.js - CSV File Comparator
Compares the first 75 rows of two CSV files:
- Uses parseCSV from parse-csv.js for file reading
- Performs field-by-field comparison via `findDifferences(obj1, obj2)`
- Reports differences with detailed output showing field name and values from both files
- Hebrew output for all console messages

**CLI Usage**: `node compare-csv.js <file1.csv> <file2.csv>`

### 3. process-csv-batch.js - Batch CSV/XLSX Processor
The most complex script, performs batch transformation of CSV/XLSX files for facial recognition research data.

**Research Data Context**:
Each file represents results from a single research participant who identified numerous face images. The data contains two types of rows:
- **faceTesting rows**: Contain the main experimental results and the conditions/properties of the face image shown
- **faceAsking rows**: Contain information about the participant's familiarity with the face. If `familiarnessKeys.keys` equals '4', the participant is considered unfamiliar with the face; any other value means they are familiar with it

**Data Transformation**:
- Filters rows to include only specific columns (defined in `REQUIRED_COLUMNS`)
- Performs special gender field transformation:
  - Detects gender column with possible names: `'female="1", male="2"'` or `'female="1"'`
  - Converts numeric values: '1' → 'female', '2' → 'male'
- Generates output filenames in format: `{participant}_{gender}-{session}.csv`
- Saves processed files to 'adapted' subdirectory

**Key Functions**:
- `findGenderColumn(row)`: Identifies gender column by name pattern matching
- `convertGender(value)`: Transforms numeric gender values to text
- `processRow(row, genderColumn)`: Applies column filtering and transformations
- `arrayToCSV(data, columns)`: Manual CSV serialization with proper escaping
- `generateOutputFileName(firstRow, originalFileName)`: Creates standardized output filename

**CLI Usage**:
- `node process-csv-batch.js` (processes current directory)
- `node process-csv-batch.js <path-to-directory>` (processes specified directory)
- `node process-csv-batch.js --help` (shows usage instructions)

## Architecture Notes

**Module Dependencies**:
- parse-csv.js is the base module (no internal dependencies)
- compare-csv.js depends on parse-csv.js for file reading
- process-csv-batch.js depends on parse-csv.js for file reading

**Data Flow Pattern**:
All scripts follow: File → Parse (via parse-csv.js) → Process → Output

**Hebrew Localization**:
All code comments and console output are in Hebrew. Variable names and function names are in English. This is consistent throughout the codebase.

## Dependencies

- `csv-parser`: Streaming CSV parser
- `xlsx`: Excel file parser (supports .xlsx and .xls)
- `path`: Node.js path utilities

## Development Commands

Install dependencies:
```bash
npm install
```

Run individual scripts:
```bash
node parse-csv.js <file-path>
node compare-csv.js <file1> <file2>
node process-csv-batch.js [directory-path]
```

## Important Implementation Details

**CSV Escaping**: The `arrayToCSV` function in process-csv-batch.js manually handles CSV escaping (commas, quotes, newlines) rather than using a library. This ensures consistent output format.

**Gender Column Detection**: The batch processor uses pattern matching to find gender columns because the original column name contains special characters and varies between files.

**Error Handling**: All scripts use try-catch blocks and provide descriptive Hebrew error messages. Scripts exit with code 1 on error.

**File Type Support**: While parse-csv.js supports .csv, .xlsx, and .xls, all output from process-csv-batch.js is always .csv format regardless of input format.
