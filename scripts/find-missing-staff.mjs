import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';
import path from 'path';
import dotenv from 'dotenv';

// Load env variables
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

// Normalize names for comparison (remove extra spaces, punctuation, lowercase)
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const filePath = path.resolve(process.cwd(), '../STAFF_TRN.xlsx');
  console.log(`Reading file: ${filePath}`);
  
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
      excelRecords.push(current);
      current = {};
    }
  }
  
  console.log(`Parsed ${excelRecords.length} staff records from Excel.`);
  
  // Fetch existing staff from local database (which points to Supabase in env)
  console.log('Fetching existing staff from database...');
  const dbStaff = await prisma.staff.findMany();
  console.log(`Found ${dbStaff.length} staff records in the database.`);
  
  // Maps/Sets for database staff lookup
  const dbIds = new Set(dbStaff.map(s => s.employee_id).filter(Boolean));
  const dbTrns = new Set(dbStaff.map(s => s.trn?.replace(/\D/g, '')).filter(Boolean));
  const dbNamesNormalized = new Set(dbStaff.map(s => normalizeName(s.name)));
  
  const missingByEmpIdAndName = [];
  
  for (const record of excelRecords) {
    const cleanRecordTrn = record.trn ? record.trn.replace(/\D/g, '') : null;
    const normalizedRecordName = normalizeName(record.name);
    
    const hasIdMatch = record.employee_id && dbIds.has(record.employee_id);
    const hasTrnMatch = cleanRecordTrn && dbTrns.has(cleanRecordTrn);
    const hasNameMatch = dbNamesNormalized.has(normalizedRecordName);
    
    // If not found in DB by ID, TRN, or Name, it is missing
    if (!hasIdMatch && !hasTrnMatch && !hasNameMatch) {
      missingByEmpIdAndName.push(record);
    }
  }
  
  console.log(`\n--- ANALYSIS RESULTS ---`);
  console.log(`Total missing staff members: ${missingByEmpIdAndName.length}`);
  
  if (missingByEmpIdAndName.length > 0) {
    console.log(`\nNames of missing staff members:`);
    missingByEmpIdAndName.forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.name} (Employee ID: ${s.employee_id || 'N/A'}, TRN: ${s.trn || 'N/A'}, NIS: ${s.nis_number || 'N/A'})`);
    });
  } else {
    console.log(`\nAll staff members in STAFF_TRN.xlsx exist in the database.`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
