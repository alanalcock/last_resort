import XLSX from 'xlsx';

const filePath = '..\\may14_2026.xls';

try {
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  console.log('Total Rows:', rows.length);

  // Print first 50 rows of data to see the general structure and column layout
  console.log('--- FIRST 50 ROWS ---');
  for (let i = 0; i < Math.min(50, rows.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }

  // Count how many start with Name: and TRN:
  let countName = 0;
  let countTRN = 0;
  let countBoth = 0;
  rows.forEach((row, i) => {
    const col0 = String(row[0] || '').trim();
    const col4 = String(row[4] || '').trim();
    if (col0.startsWith('Name:')) countName++;
    if (col4.includes('TRN:')) countTRN++;
    
    // Check if Name: and TRN: exists anywhere in the row
    const hasName = row.some(cell => String(cell || '').trim().startsWith('Name:'));
    const hasTRN = row.some(cell => String(cell || '').trim().includes('TRN:'));
    if (hasName && hasTRN) {
      countBoth++;
    }
  });

  console.log(`\nStatistics:`);
  console.log(`- Rows with Name: at col 0: ${countName}`);
  console.log(`- Rows with TRN: at col 4: ${countTRN}`);
  console.log(`- Rows with both Name: and TRN: anywhere: ${countBoth}`);

} catch (err) {
  console.error('Error reading excel file:', err);
}
