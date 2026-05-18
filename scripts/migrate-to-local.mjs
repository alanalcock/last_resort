import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrate() {
  console.log('Starting migration from Supabase to Local SQLite...');

  // 1. Settings
  console.log('Migrating settings...');
  const { data: settings, error: settingsError } = await supabase.from('settings').select('*');
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  } else if (settings) {
    for (const s of settings) {
      await prisma.setting.upsert({
        where: { key: s.key },
        update: { value: s.value, updated_at: new Date(s.updated_at) },
        create: { key: s.key, value: s.value, updated_at: new Date(s.updated_at) },
      });
    }
    console.log(`Migrated ${settings.length} settings.`);
  }

  // 2. Staff
  console.log('Migrating staff...');
  const { data: staff, error: staffError } = await supabase.from('staff').select('*');
  if (staffError) {
    console.error('Error fetching staff:', staffError);
  } else if (staff) {
    for (const s of staff) {
      await prisma.staff.upsert({
        where: { id: Number(s.id) },
        update: {
          name: s.name,
          email: s.email,
          status: s.status,
          joined_date: s.joined_date,
          trn: s.trn,
          phone: s.phone,
          nis_number: s.nis_number,
          employee_id: s.employee_id,
          send_whatsapp: s.send_whatsapp,
          send_email: s.send_email,
          created_at: new Date(s.created_at),
          updated_at: new Date(s.updated_at),
        },
        create: {
          id: Number(s.id),
          name: s.name,
          email: s.email,
          status: s.status,
          joined_date: s.joined_date,
          trn: s.trn,
          phone: s.phone,
          nis_number: s.nis_number,
          employee_id: s.employee_id,
          send_whatsapp: s.send_whatsapp,
          send_email: s.send_email,
          created_at: new Date(s.created_at),
          updated_at: new Date(s.updated_at),
        },
      });
    }
    console.log(`Migrated ${staff.length} staff members.`);
  }

  // 3. Delivery Logs
  console.log('Migrating delivery logs...');
  const { data: logs, error: logsError } = await supabase.from('delivery_logs').select('*');
  if (logsError) {
    console.error('Error fetching logs:', logsError);
  } else if (logs) {
    for (const l of logs) {
      await prisma.deliveryLog.upsert({
        where: { id: Number(l.id) },
        update: {
          staff_id: l.staff_id ? Number(l.staff_id) : null,
          date_sent: l.date_sent,
          whatsapp_status: l.whatsapp_status,
          email_status: l.email_status,
          created_at: new Date(l.created_at),
        },
        create: {
          id: Number(l.id),
          staff_id: l.staff_id ? Number(l.staff_id) : null,
          date_sent: l.date_sent,
          whatsapp_status: l.whatsapp_status,
          email_status: l.email_status,
          created_at: new Date(l.created_at),
        },
      });
    }
    console.log(`Migrated ${logs.length} delivery logs.`);
  }

  // 4. Broadcast Runs
  console.log('Migrating broadcast runs...');
  const { data: runs, error: runsError } = await supabase.from('broadcast_runs').select('*');
  if (runsError) {
    console.error('Error fetching broadcast runs:', runsError);
  } else if (runs) {
    for (const r of runs) {
      await prisma.broadcastRun.upsert({
        where: { id: Number(r.id) },
        update: {
          created_at: new Date(r.created_at),
          filename: r.filename,
          total_records: r.total_records,
          matched_records: r.matched_records,
          sent_records: r.sent_records,
        },
        create: {
          id: Number(r.id),
          created_at: new Date(r.created_at),
          filename: r.filename,
          total_records: r.total_records,
          matched_records: r.matched_records,
          sent_records: r.sent_records,
        },
      });
    }
    console.log(`Migrated ${runs.length} broadcast runs.`);
  }

  console.log('Migration completed successfully!');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
