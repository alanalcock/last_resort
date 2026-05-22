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
  console.log('Connecting to Supabase PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Successfully connected to database!');

    // Read sqlite data backup
    let data;
    try {
      data = JSON.parse(fs.readFileSync('sqlite_data_backup.json', 'utf8'));
    } catch (err) {
      console.error('Error reading sqlite_data_backup.json:', err.message);
      console.log('Running script to fetch up-to-date backup from SQLite...');
      // If the backup doesn't exist, we read it
      process.exit(1);
    }

    const staffRows = data.staff || [];
    const settingRows = data.settings || [];
    const deliveryRows = data.logs || [];
    const broadcastRows = data.broadcasts || [];
    const payslipRows = data.payslips || [];
    const attendanceRows = data.attendance || [];
    const adminSetting = settingRows.find((row) => row.key === 'admins_list');
    let adminRows = [];
    if (adminSetting?.value) {
      try {
        const parsedAdmins = JSON.parse(adminSetting.value);
        if (Array.isArray(parsedAdmins)) {
          adminRows = parsedAdmins;
        }
      } catch (err) {
        console.error('Failed to parse legacy admins_list:', err.message);
      }
    }
    const legacyAdminStaffIds = new Set(
      adminRows
        .filter((admin) => !admin?.isDefault && admin?.staffId)
        .map((admin) => Number(admin.staffId))
        .filter((id) => Number.isFinite(id))
    );

    console.log(`\n--- Starting Data Migration ---`);
    console.log(`Staff records:      ${staffRows.length}`);
    console.log(`Setting records:    ${settingRows.length}`);
    console.log(`DeliveryLog records:${deliveryRows.length}`);
    console.log(`BroadcastRun records:${broadcastRows.length}`);
    console.log(`Payslip records:    ${payslipRows.length}`);
    console.log(`AttendanceLog records: ${attendanceRows.length}`);
    console.log(`Admin records:      ${adminRows.length > 0 ? adminRows.length : 1}`);
    console.log(`--------------------------------\n`);

    // 1. Migrate Staff
    console.log('Migrating Staff...');
    let staffCount = 0;
    for (const row of staffRows) {
      if (legacyAdminStaffIds.has(Number(row.id))) {
        continue;
      }

      const createdAt = new Date(row.created_at || Date.now());
      const updatedAt = new Date(row.updated_at || Date.now());
      const sendWhatsapp = row.send_whatsapp === 1 || row.send_whatsapp === true;
      const sendEmail = row.send_email === 1 || row.send_email === true;

      const query = `
        INSERT INTO "Staff" (
          "id", "name", "email", "status", "joined_date", "trn", "phone", 
          "nis_number", "employee_id", "password", "send_whatsapp", "send_email", 
          "created_at", "updated_at", "home_address", "employment_date", "insurance", 
          "insurance_expiry", "psra", "psra_expiry", "job_role"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
          "updated_at" = EXCLUDED."updated_at",
          "home_address" = EXCLUDED."home_address",
          "employment_date" = EXCLUDED."employment_date",
          "insurance" = EXCLUDED."insurance",
          "insurance_expiry" = EXCLUDED."insurance_expiry",
          "psra" = EXCLUDED."psra",
          "psra_expiry" = EXCLUDED."psra_expiry",
          "job_role" = EXCLUDED."job_role"
      `;

      const values = [
        row.id,
        row.name,
        row.email,
        row.status || 'Active',
        row.joined_date || row.dob,
        row.trn,
        row.phone,
        row.nis_number,
        row.employee_id,
        row.password,
        sendWhatsapp,
        sendEmail,
        createdAt,
        updatedAt,
        row.home_address,
        row.employment_date,
        row.insurance,
        row.insurance_expiry,
        row.psra,
        row.psra_expiry,
        row.job_role
      ];

      try {
        await client.query(query, values);
        staffCount++;
      } catch (err) {
        console.error(`Failed to migrate Staff ${row.name} (ID: ${row.id}):`, err.message);
      }
    }
    console.log(`Staff migration completed: ${staffCount}/${staffRows.length} successfully migrated.`);

    // 2. Migrate Settings
    console.log('Migrating Settings...');
    let settingsCount = 0;
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
        settingsCount++;
      } catch (err) {
        console.error(`Failed to migrate Setting ${row.key}:`, err.message);
      }
    }
    console.log(`Settings migration completed: ${settingsCount}/${settingRows.length} successfully migrated.`);

    // 3. Migrate BroadcastRuns
    console.log('Migrating BroadcastRuns...');
    let broadcastCount = 0;
    for (const row of broadcastRows) {
      const createdAt = new Date(row.created_at || Date.now());
      const query = `
        INSERT INTO "BroadcastRun" (
          "id", "created_at", "filename", "total_records", "matched_records", "sent_records"
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("id") DO UPDATE SET
          "filename" = EXCLUDED."filename",
          "total_records" = EXCLUDED."total_records",
          "matched_records" = EXCLUDED."matched_records",
          "sent_records" = EXCLUDED."sent_records",
          "created_at" = EXCLUDED."created_at"
      `;
      const values = [
        row.id,
        createdAt,
        row.filename,
        row.total_records,
        row.matched_records,
        row.sent_records
      ];
      try {
        await client.query(query, values);
        broadcastCount++;
      } catch (err) {
        console.error(`Failed to migrate BroadcastRun ID ${row.id}:`, err.message);
      }
    }
    console.log(`BroadcastRuns migration completed: ${broadcastCount}/${broadcastRows.length} successfully migrated.`);

    // 4. Migrate DeliveryLogs
    console.log('Migrating DeliveryLogs...');
    let deliveryCount = 0;
    for (const row of deliveryRows) {
      const createdAt = new Date(row.created_at || Date.now());
      const payslipData = typeof row.payslip_data === 'string' ? JSON.parse(row.payslip_data) : row.payslip_data;

      const query = `
        INSERT INTO "DeliveryLog" (
          "id", "staff_id", "date_sent", "whatsapp_status", "email_status", "payslip_data", "created_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("id") DO UPDATE SET
          "staff_id" = EXCLUDED."staff_id",
          "date_sent" = EXCLUDED."date_sent",
          "whatsapp_status" = EXCLUDED."whatsapp_status",
          "email_status" = EXCLUDED."email_status",
          "payslip_data" = EXCLUDED."payslip_data",
          "created_at" = EXCLUDED."created_at"
      `;
      const values = [
        row.id,
        row.staff_id,
        row.date_sent,
        row.whatsapp_status,
        row.email_status,
        payslipData,
        createdAt
      ];
      try {
        await client.query(query, values);
        deliveryCount++;
      } catch (err) {
        console.error(`Failed to migrate DeliveryLog ID ${row.id}:`, err.message);
      }
    }
    console.log(`DeliveryLogs migration completed: ${deliveryCount}/${deliveryRows.length} successfully migrated.`);

    // 5. Migrate Payslips
    console.log('Migrating Payslips...');
    let payslipCount = 0;
    for (const row of payslipRows) {
      const createdAt = new Date(row.created_at || Date.now());
      const earnings = typeof row.earnings === 'string' ? JSON.parse(row.earnings) : row.earnings;
      const deductions = typeof row.deductions === 'string' ? JSON.parse(row.deductions) : row.deductions;
      const rawRows = typeof row.raw_rows === 'string' ? JSON.parse(row.raw_rows) : row.raw_rows;

      const query = `
        INSERT INTO "Payslip" (
          "id", "staff_id", "pay_date", "pay_period", "total_current", "total_ytd", 
          "deduction_current", "deduction_ytd", "net_pay_current", "net_pay_ytd", 
          "vacation_used", "benefits", "paye_refund", "earnings", "deductions", "raw_rows", "created_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT ("id") DO UPDATE SET
          "staff_id" = EXCLUDED."staff_id",
          "pay_date" = EXCLUDED."pay_date",
          "pay_period" = EXCLUDED."pay_period",
          "total_current" = EXCLUDED."total_current",
          "total_ytd" = EXCLUDED."total_ytd",
          "deduction_current" = EXCLUDED."deduction_current",
          "deduction_ytd" = EXCLUDED."deduction_ytd",
          "net_pay_current" = EXCLUDED."net_pay_current",
          "net_pay_ytd" = EXCLUDED."net_pay_ytd",
          "vacation_used" = EXCLUDED."vacation_used",
          "benefits" = EXCLUDED."benefits",
          "paye_refund" = EXCLUDED."paye_refund",
          "earnings" = EXCLUDED."earnings",
          "deductions" = EXCLUDED."deductions",
          "raw_rows" = EXCLUDED."raw_rows",
          "created_at" = EXCLUDED."created_at"
      `;
      const values = [
        row.id,
        row.staff_id,
        row.pay_date,
        row.pay_period,
        row.total_current,
        row.total_ytd,
        row.deduction_current,
        row.deduction_ytd,
        row.net_pay_current,
        row.net_pay_ytd,
        row.vacation_used,
        row.benefits,
        row.paye_refund,
        earnings,
        deductions,
        rawRows,
        createdAt
      ];
      try {
        await client.query(query, values);
        payslipCount++;
      } catch (err) {
        console.error(`Failed to migrate Payslip ID ${row.id}:`, err.message);
      }
    }
    console.log(`Payslips migration completed: ${payslipCount}/${payslipRows.length} successfully migrated.`);

    // 6. Migrate AttendanceLogs
    console.log('Migrating AttendanceLogs...');
    let attendanceCount = 0;
    for (const row of attendanceRows) {
      const createdAt = new Date(row.created_at || Date.now());
      const updatedAt = new Date(row.updated_at || Date.now());

      const query = `
        INSERT INTO "AttendanceLog" (
          "id", "staff_id", "date", "status", "present_type", "leave_type", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT ("id") DO UPDATE SET
          "staff_id" = EXCLUDED."staff_id",
          "date" = EXCLUDED."date",
          "status" = EXCLUDED."status",
          "present_type" = EXCLUDED."present_type",
          "leave_type" = EXCLUDED."leave_type",
          "created_at" = EXCLUDED."created_at",
          "updated_at" = EXCLUDED."updated_at"
      `;
      const values = [
        row.id,
        row.staff_id,
        row.date,
        row.status,
        row.present_type,
        row.leave_type,
        createdAt,
        updatedAt
      ];
      try {
        await client.query(query, values);
        attendanceCount++;
      } catch (err) {
        console.error(`Failed to migrate AttendanceLog ID ${row.id}:`, err.message);
      }
    }
    console.log(`AttendanceLogs migration completed: ${attendanceCount}/${attendanceRows.length} successfully migrated.`);

    // 7. Migrate Admins
    console.log('Migrating Admins...');
    const fallbackAdmins = adminRows.length > 0
      ? adminRows
      : [{ name: 'Default Admin', username: 'admin', password: 'admin', role: 'System Owner', isDefault: true }];
    let adminCount = 0;
    for (const row of fallbackAdmins) {
      const createdAt = new Date(row.created_at || Date.now());
      const updatedAt = new Date(row.updated_at || Date.now());
      const query = `
        INSERT INTO "Admin" (
          "name", "username", "password", "role", "is_default", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("username") DO UPDATE SET
          "name" = EXCLUDED."name",
          "password" = EXCLUDED."password",
          "role" = EXCLUDED."role",
          "is_default" = EXCLUDED."is_default",
          "updated_at" = EXCLUDED."updated_at"
      `;
      const values = [
        row.name || 'Administrator',
        String(row.username || '').trim().toLowerCase(),
        row.password || null,
        row.role || 'Administrator',
        Boolean(row.isDefault),
        createdAt,
        updatedAt,
      ];
      try {
        await client.query(query, values);
        adminCount++;
      } catch (err) {
        console.error(`Failed to migrate Admin ${row.username}:`, err.message);
      }
    }
    console.log(`Admins migration completed: ${adminCount}/${fallbackAdmins.length} successfully migrated.`);

    // 8. Reset Postgres ID Auto-increment Sequences
    console.log('\nResetting primary key auto-increment sequences in PostgreSQL...');
    const tablesToReset = ['Staff', 'Admin', 'DeliveryLog', 'BroadcastRun', 'Payslip', 'AttendanceLog'];
    for (const table of tablesToReset) {
      try {
        await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 1)) FROM "${table}"`);
        console.log(`Successfully reset sequence for table "${table}".`);
      } catch (err) {
        console.warn(`Warning: Could not reset sequence for table "${table}":`, err.message);
      }
    }

    console.log('\n--- Migration Finished Successfully! ---');

  } catch (e) {
    console.error('Fatal Migration Error:', e);
  } finally {
    await client.end();
  }
}

main();
