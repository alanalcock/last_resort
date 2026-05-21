import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching an active staff member...');
    const activeStaff = await prisma.staff.findFirst({
      where: { status: 'Active' }
    });

    if (!activeStaff) {
      console.log('No active staff member found to promote.');
      return;
    }

    console.log(`Found active staff member: ${activeStaff.name} (ID: ${activeStaff.id}, Emp ID: ${activeStaff.employee_id})`);

    // Let's mimic handlePromoteStaffToAdmin
    const staffId = activeStaff.id;
    const name = activeStaff.name;
    const username = 'testadmin';

    // 1. Fetch current admins
    const adminSetting = await prisma.setting.findUnique({
      where: { key: 'admins_list' }
    });

    let admins = [
      { username: 'admin', password: 'admin', role: 'System Owner', name: 'Default Admin', isDefault: true }
    ];

    if (adminSetting && adminSetting.value) {
      admins = JSON.parse(adminSetting.value);
    }

    if (admins.some(a => !a.isDefault && String(a.staffId) === String(staffId))) {
      console.log(`Staff member ${name} is already an admin. Revoking first to perform a clean promotion...`);
      admins = admins.filter(a => String(a.staffId) !== String(staffId));
    }

    const newAdmin = {
      id: Date.now().toString(),
      staffId: staffId.toString(),
      name: name,
      username: username.toLowerCase(),
      role: 'Administrator',
      isDefault: false
    };

    // 2. Set the staff member's password to null in Supabase
    console.log(`Setting password to null for ${name} in Staff table...`);
    await prisma.staff.update({
      where: { id: staffId },
      data: { password: null }
    });

    // 3. Save new admins list
    const updatedAdmins = [...admins, newAdmin];
    console.log('Updating admins_list in Setting table...');
    await prisma.setting.upsert({
      where: { key: 'admins_list' },
      update: { value: JSON.stringify(updatedAdmins) },
      create: { key: 'admins_list', value: JSON.stringify(updatedAdmins) }
    });

    console.log('Promotion complete!');
    console.log('\nUpdated Setting [admins_list]:');
    console.log(JSON.stringify(updatedAdmins, null, 2));

    // Verify staff record
    const updatedStaff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    console.log('\nVerified Staff Record:');
    console.log(`ID: ${updatedStaff.id} | Name: ${updatedStaff.name} | Password is null: ${updatedStaff.password === null}`);
  } catch (error) {
    console.error('Error during test promotion:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
