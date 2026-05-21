import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching all staff members from database...');
    const allStaff = await prisma.staff.findMany();
    
    console.log(`Found ${allStaff.length} staff records. Initiating status migrations...`);
    
    let activeMigrated = 0;
    let inactiveMigrated = 0;
    let leaveMigrated = 0;
    let unchanged = 0;

    for (const member of allStaff) {
      let newStatus = null;
      
      if (member.status === 'Active') {
        newStatus = 'Employ';
        activeMigrated++;
      } else if (member.status === 'Inactive') {
        newStatus = 'Unuemploy';
        inactiveMigrated++;
      } else if (member.status === 'On Leave') {
        newStatus = 'Loa';
        leaveMigrated++;
      } else {
        unchanged++;
      }

      if (newStatus) {
        await prisma.staff.update({
          where: { id: member.id },
          data: { status: newStatus }
        });
        console.log(`Updated Staff: ${member.name} (ID: ${member.id}) from "${member.status}" to "${newStatus}"`);
      }
    }

    console.log('\n--- Migration Results ---');
    console.log(`Migrated "Active" to "Employ":    ${activeMigrated}`);
    console.log(`Migrated "Inactive" to "Unuemploy": ${inactiveMigrated}`);
    console.log(`Migrated "On Leave" to "Loa":      ${leaveMigrated}`);
    console.log(`Unchanged records:                ${unchanged}`);
    console.log('-------------------------');
    console.log('Migration complete successfully!');

  } catch (error) {
    console.error('Error migrating staff statuses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
