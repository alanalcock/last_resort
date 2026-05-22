import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const totalLogs = await prisma.deliveryLog.count();
  console.log(`Total DeliveryLogs in DB: ${totalLogs}`);

  const recentRuns = await prisma.broadcastRun.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });

  console.log('\n--- RECENT BROADCAST RUNS ---');
  recentRuns.forEach(r => {
    console.log(`- Date: ${r.created_at.toISOString()}, File: ${r.filename}, Total Records: ${r.total_records}, Matched: ${r.matched_records}, Sent/Published: ${r.sent_records}`);
  });

  const recentLogs = await prisma.deliveryLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 10,
    include: {
      staff: {
        select: { name: true }
      }
    }
  });

  console.log('\n--- 10 MOST RECENT INDIVIDUAL DELIVERIES SAVED ---');
  recentLogs.forEach(l => {
    console.log(`- [${l.created_at.toISOString()}] Staff ID: ${l.staff_id} (${l.staff?.name || 'Unknown'}), DateSent: ${l.date_sent}, WhatsApp Status: ${l.whatsapp_status}, Email Status: ${l.email_status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
