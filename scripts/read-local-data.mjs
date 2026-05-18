import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading data from SQLite...');
  try {
    const staff = await prisma.staff.findMany();
    const settings = await prisma.setting.findMany();
    const logs = await prisma.deliveryLog.findMany();
    const broadcasts = await prisma.broadcastRun.findMany();
    
    const backup = { staff, settings, logs, broadcasts };
    fs.writeFileSync('sqlite_data_backup.json', JSON.stringify(backup, null, 2));
    console.log(`Successfully backed up:
- ${staff.length} staff members
- ${settings.length} settings
- ${logs.length} delivery logs
- ${broadcasts.length} broadcast runs`);
  } catch (e) {
    console.error('Error reading SQLite data:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
