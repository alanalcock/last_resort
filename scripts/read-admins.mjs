import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function readAdmins() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'admins_list' }
    });

    if (!setting || !setting.value) {
      console.log('No admins list found.');
    } else {
      console.log(JSON.stringify(JSON.parse(setting.value), null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

readAdmins();
