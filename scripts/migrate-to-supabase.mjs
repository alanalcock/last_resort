import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in environment!');
  process.exit(1);
}

async function main() {
  console.log('Connecting to Supabase Postgres database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Successfully connected!');

    // Read backed up SQLite data
    const data = JSON.parse(fs.readFileSync('sqlite_data_backup.json', 'utf8'));
    const staffRows = data.staff || [];
    const settingRows = data.settings || [];

    console.log(`Starting migration of ${staffRows.length} staff records and ${settingRows.length} settings...`);

    // 1. Migrate Staff
    let migratedStaffCount = 0;
    for (const row of staffRows) {
      const createdAt = new Date(row.created_at || Date.now());
      const updatedAt = new Date(row.updated_at || Date.now());
      const sendWhatsapp = row.send_whatsapp === 1;
      const sendEmail = row.send_email === 1;

      const query = `
        INSERT INTO "Staff" (
          "id", "name", "email", "status", "joined_date", "trn", "phone", 
          "nis_number", "employee_id", "password", "send_whatsapp", "send_email", 
          "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "email" = EXCLUDED."email",
          "status" = EXCLUDED."status",
          "joined_date" = EXCLUDED."joined_date",
          "trn" = EXCLUDED."trn",
          "phone" = EXCLUDED."phone",
          "nis_number" = EXCLUDED."nis_number",
          "employee_id" = EXCLUDED."employee_id",
          "password" = EXCLUDED."password",
          "send_whatsapp" = EXCLUDED."send_whatsapp",
          "send_email" = EXCLUDED."send_email",
          "updated_at" = EXCLUDED."updated_at"
      `;

      const values = [
        row.id,
        row.name,
        row.email,
        row.status,
        row.joined_date,
        row.trn,
        row.phone,
        row.nis_number,
        row.employee_id,
        row.password,
        sendWhatsapp,
        sendEmail,
        createdAt,
        updatedAt
      ];

      try {
        await client.query(query, values);
        migratedStaffCount++;
      } catch (err) {
        console.error(`Failed to migrate staff member ${row.name} (ID: ${row.id}):`, err.message);
      }
    }
    console.log(`Staff migration completed! Migrated ${migratedStaffCount}/${staffRows.length} staff records.`);

    // 2. Migrate Settings
    let migratedSettingsCount = 0;
    for (const row of settingRows) {
      const updatedAt = new Date(row.updated_at || Date.now());
      const query = `
        INSERT INTO "Setting" ("key", "value", "updated_at")
        VALUES ($1, $2, $3)
        ON CONFLICT ("key") DO UPDATE SET
          "value" = EXCLUDED."value",
          "updated_at" = EXCLUDED."updated_at"
      `;
      const values = [row.key, row.value, updatedAt];
      try {
        await client.query(query, values);
        migratedSettingsCount++;
      } catch (err) {
        console.error(`Failed to migrate setting ${row.key}:`, err.message);
      }
    }
    console.log(`Settings migration completed! Migrated ${migratedSettingsCount}/${settingRows.length} settings.`);

    // 3. Reset Postgres ID Auto-increment Sequence
    if (staffRows.length > 0) {
      console.log('Resetting Staff ID sequence in PostgreSQL...');
      await client.query(`SELECT setval(pg_get_serial_sequence('"Staff"', 'id'), coalesce(max(id), 1)) FROM "Staff"`);
      console.log('Successfully reset sequence!');
    }

    console.log('Data migration successfully finished!');

  } catch (e) {
    console.error('Fatal migration error:', e);
  } finally {
    await client.end();
  }
}

main();
