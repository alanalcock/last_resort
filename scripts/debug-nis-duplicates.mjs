import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
const prisma = new PrismaClient();

function cleanName(rawName) {
  let name = rawName.replace(/^(Mr|Ms|Mrs|Miss|Dr)\s+/i, '').trim();
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
       name = `${parts[1]} ${parts[0]}`;
    }
  }
  return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function main() {
  const filePath = path.resolve(process.cwd(), '../STAFF_TRN.xlsx');
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const excelRecords = [];
  let current = {};
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[1] && typeof row[1] === 'number' && rows[i + 2] && rows[i + 2][1] && typeof rows[i + 2][1] === 'string' && row[1] > 0) {
      current = {
        employee_id: row[1].toString(),
        name: cleanName(rows[i + 2][1])
      };
    }
    if (row[1] === 'Home Phone:') {
      if (row[3] === 'NIS:') {
        current.nis_number = row[4] ? row[4].toString().trim() : null;
      }
    }
    if (row[1] === 'Cell Phone:') {
      if (row[3] === 'TRN:') {
        current.trn = row[4] ? row[4].toString().trim() : null;
      }
    }
    if (row[1] === 'Address:' && current.employee_id) {
      excelRecords.push(current);
      current = {};
    }
  }

  const dbStaff = await prisma.staff.findMany();
  
  const dbNisMap = new Map();
  dbStaff.forEach(s => {
    if (s.nis_number) {
      dbNisMap.set(s.nis_number.trim(), s);
    }
  });

  console.log('--- NIS DUPLICATE CHECK ---');
  for (const rec of excelRecords) {
    if (rec.nis_number) {
      const dbMatch = dbNisMap.get(rec.nis_number.trim());
      if (dbMatch && dbMatch.employee_id !== rec.employee_id) {
        console.log(`Conflict: Excel record "${rec.name}" (EmpId: ${rec.employee_id}, NIS: ${rec.nis_number}) has same NIS as DB record "${dbMatch.name}" (EmpId: ${dbMatch.employee_id}, DB ID: ${dbMatch.id})`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
