import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Testing query: prisma.attendanceLog.findMany with include: { staff: true }');
  try {
    const logs = await prisma.attendanceLog.findMany({
      where: {
        date: '2026-05-22',
      },
      include: {
        staff: true,
      },
    });
    console.log(`Query succeeded! Found ${logs.length} logs.`);
  } catch (error) {
    console.error('Query failed with error:');
    console.error(error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
