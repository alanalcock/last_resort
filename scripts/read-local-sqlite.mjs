import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

async function main() {
  console.log('Reading SQLite data using native node:sqlite...');
  try {
    const db = new DatabaseSync('prisma/dev.db');
    
    // Helper to run query safely
    const queryAll = (table) => {
      try {
        const stmt = db.prepare(`SELECT * FROM "${table}"`);
        return stmt.all();
      } catch (e) {
        console.warn(`Warning: Could not read table ${table}:`, e.message);
        return [];
      }
    };

    const staff = queryAll('Staff');
    const settings = queryAll('Setting');
    const logs = queryAll('DeliveryLog');
    const broadcasts = queryAll('BroadcastRun');

    const backup = { staff, settings, logs, broadcasts };
    fs.writeFileSync('sqlite_data_backup.json', JSON.stringify(backup, null, 2));

    console.log(`Successfully backed up SQLite data:
- ${staff.length} staff members
- ${settings.length} settings
- ${logs.length} delivery logs
- ${broadcasts.length} broadcast runs`);
  } catch (e) {
    console.error('Error reading SQLite database:', e);
  }
}

main();
