import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const filePath = '..\\may14_2026.xls';

const normalizeTrn = (val) => String(val ?? '').replace(/\D/g, '');

async function main() {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const excelRecords = [];
  rows.forEach((row, index) => {
    const col0 = String(row[0] || '').trim();
    const col4 = String(row[4] || '').trim();
    if (col0.startsWith('Name:') && col4.includes('TRN:')) {
      const nameMatch = col0.match(/^Name:\s*(.*?)(?:,\s*(.*))?$/i);
      const trnMatch = col4.match(/TRN:\s*([0-9]+)/i);
      excelRecords.push({
        index,
        rawName: col0,
        rawTrn: col4,
        parsedName: nameMatch?.[1]?.trim() ?? '',
        parsedTrn: trnMatch?.[1]?.trim() ?? '',
      });
    }
  });

  const dbStaff = await prisma.staff.findMany({
    select: {
      id: true,
      name: true,
      trn: true,
      employee_id: true,
    }
  });

  const dbStaffByTrn = new Map();
  dbStaff.forEach(s => {
    const norm = normalizeTrn(s.trn);
    if (norm) {
      dbStaffByTrn.set(norm, s);
    }
  });

  console.log(`Total Excel Payslip Blocks Found: ${excelRecords.length}`);
  console.log(`Total Database Staff Records Found: ${dbStaff.length}`);

  const matched = [];
  const unmatched = [];

  excelRecords.forEach(rec => {
    const normTrn = normalizeTrn(rec.parsedTrn);
    const dbMatch = dbStaffByTrn.get(normTrn);
    if (dbMatch) {
      matched.push({ excel: rec, db: dbMatch });
    } else {
      unmatched.push(rec);
    }
  });

  console.log(`\nMatched count: ${matched.length}`);
  console.log(`Unmatched count: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n--- UNMATCHED PAYSLIPS (In Excel but NOT in DB, or TRN mismatch) ---');
    unmatched.forEach((u, i) => {
      console.log(`${i+1}. Excel Name: "${u.parsedName}", Excel TRN: "${u.parsedTrn}" (Raw: "${u.rawTrn}")`);
    });
  }

  // Also let's check if there are database staff who don't have a TRN
  const noTrnDb = dbStaff.filter(s => !s.trn);
  if (noTrnDb.length > 0) {
    console.log('\n--- DB STAFF WITH NO TRN ---');
    noTrnDb.forEach(s => {
      console.log(`- DB Name: "${s.name}", ID: ${s.id}, Employee ID: ${s.employee_id}`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
