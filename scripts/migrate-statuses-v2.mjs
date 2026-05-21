import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fetching all staff members from database...');
    const allStaff = await prisma.staff.findMany();
    
    console.log(`Found ${allStaff.length} staff records. Initiating status migrations...`);
    
    let employeedCount = 0;
    let unemployeesCount = 0;
    let leaveOfAbsenceCount = 0;
    let unchanged = 0;

    for (const member of allStaff) {
      let newStatus = null;
      
      const currentStatus = member.status;
      if (currentStatus === 'Employ' || currentStatus === 'Active') {
        newStatus = 'Employeed';
        employeedCount++;
      } else if (currentStatus === 'Unuemploy' || currentStatus === 'Inactive') {
        newStatus = 'Unemployees';
        unemployeesCount++;
      } else if (currentStatus === 'Loa' || currentStatus === 'On Leave') {
        newStatus = 'Leave of Absence';
        leaveOfAbsenceCount++;
      } else {
        unchanged++;
      }

      if (newStatus) {
        await prisma.staff.update({
          where: { id: member.id },
          data: { status: newStatus }
        });
        console.log(`Updated Staff: ${member.name} (ID: ${member.id}) from "${currentStatus}" to "${newStatus}"`);
      }
    }

    console.log('\n--- Migration V2 Results ---');
    console.log(`Migrated to "Employeed":        ${employeedCount}`);
    console.log(`Migrated to "Unemployees":      ${unemployeesCount}`);
    console.log(`Migrated to "Leave of Absence": ${leaveOfAbsenceCount}`);
    console.log(`Unchanged records:              ${unchanged}`);
    console.log('----------------------------');
    console.log('Migration V2 complete successfully!');

  } catch (error) {
    console.error('Error migrating staff statuses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
