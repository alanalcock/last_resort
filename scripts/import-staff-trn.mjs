import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

function cleanName(rawName) {
  // Remove titles like Mr, Ms, Mrs, Miss
  let name = rawName.replace(/^(Mr|Ms|Mrs|Miss|Dr)\s+/i, '').trim();
  // Handle comma format: LASTNAME, FIRSTNAME -> FIRSTNAME LASTNAME
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
       name = `${parts[1]} ${parts[0]}`;
    }
  }
  // Convert to Title Case
  return name.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

async function main() {
  const filePath = path.resolve(process.cwd(), '../STAFF_TRN.xlsx');
  console.log(`Reading file: ${filePath}`);
  
  if (!xlsx.utils) {
      console.error("XLSX utils not found. Make sure xlsx is installed.");
      return;
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const staffRecords = [];
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
      if (row[2]) {
        current.phone = row[2].toString().trim();
      }
    }
    
    if (row[1] === 'Cell Phone:') {
      if (row[3] === 'TRN:') {
        current.trn = row[4] ? row[4].toString().trim() : null;
      }
      if (row[2]) {
        current.phone = row[2].toString().trim();
      }
    }

    if (row[1] === 'Business Phone:') {
      if (!current.phone && row[2]) {
        current.phone = row[2].toString().trim();
      }
    }
    
    if (row[1] === 'Address:' && current.employee_id) {
      staffRecords.push(current);
      current = {};
    }
  }
  
  console.log(`Parsed ${staffRecords.length} staff records from Excel.`);
  
  if (staffRecords.length === 0) {
    console.log("No records found to import.");
    return;
  }
  
  console.log('Fetching existing staff from local database...');
  const existingStaff = await prisma.staff.findMany();
  
  const existingMapByEmpId = new Map(existingStaff.map(s => [s.employee_id, s]));
  
  console.log('Processing upserts...');
  let upsertCount = 0;
  for (const r of staffRecords) {
    const existing = existingMapByEmpId.get(r.employee_id);
    if (existing) {
        await prisma.staff.update({
            where: { id: existing.id },
            data: { ...r, updated_at: new Date() }
        });
    } else {
        await prisma.staff.create({
            data: { ...r, email: null }
        });
    }
    upsertCount++;
  }
  
  console.log(`Successfully processed ${upsertCount} records into the local staff table.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
