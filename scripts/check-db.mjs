import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.staff.count();
  console.log(`Total staff in database: ${count}`);
  const staff = await prisma.staff.findMany({
    select: {
      id: true,
      name: true,
      trn: true,
      employee_id: true,
      status: true
    }
  });
  console.log('--- ALL STAFF IN DB ---');
  staff.forEach(s => {
    console.log(`- ID: ${s.id}, Name: ${s.name}, TRN: ${s.trn}, EmpID: ${s.employee_id}, Status: ${s.status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
