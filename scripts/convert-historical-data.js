import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📊 Converting historical data to JSON...\n');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'SP25 3370-01_MedicaInitialHistoricData.xlsx'));

const historicalData = {};

// Process each sheet
workbook.SheetNames.forEach(sheetName => {
  console.log(`Processing sheet: ${sheetName}`);

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (data.length === 0) return;

  // Row 0 is headers
  const headers = data[0];

  // Convert to array of objects
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] && headers[j] !== '') {
        row[headers[j]] = data[i][j];
      }
    }
    rows.push(row);
  }

  historicalData[sheetName] = {
    headers,
    data: rows
  };
});

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'src', 'client', 'data', 'historicalData.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(historicalData, null, 2));

console.log(`\n✅ Historical data converted and saved to: ${outputPath}`);
console.log(`📈 Sheets processed: ${Object.keys(historicalData).length}`);
console.log(`📅 Days of data: ${historicalData['Standard']?.data?.length || 0}`);
