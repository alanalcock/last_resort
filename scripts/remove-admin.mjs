import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeAdmin() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'admins_list' }
    });

    if (!setting || !setting.value) {
      console.log('No admins list found in settings.');
      return;
    }

    const admins = JSON.parse(setting.value);
    const initialCount = admins.length;
    
    // Filter out Richard Black (case-insensitive check)
    const updatedAdmins = admins.filter(admin => !admin.name.toLowerCase().includes('richard black'));

    if (updatedAdmins.length === initialCount) {
      console.log('Richard Black was not found in the admins list.');
      return;
    }

    await prisma.setting.update({
      where: { key: 'admins_list' },
      data: { value: JSON.stringify(updatedAdmins) }
    });

    console.log(`Successfully removed Richard Plack from admin access. Admin count went from ${initialCount} to ${updatedAdmins.length}.`);
  } catch (error) {
    console.error('Error removing admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeAdmin();
