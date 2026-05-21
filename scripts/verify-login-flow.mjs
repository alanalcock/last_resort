import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Helper to hash password using SHA-256 (matches browser crypto.subtle.digest in Next.js route)
function sha256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function simulateLogin(usernameInput, passwordInput) {
  console.log(`\n--- Simulating Login for: "${usernameInput}" / "${passwordInput}" ---`);
  const cleanInputName = String(usernameInput || '').trim().toLowerCase().replace(/\s+/g, '');

  // 1. Load admins
  const adminSetting = await prisma.setting.findUnique({
    where: { key: 'admins_list' }
  });

  let admins = [];
  if (adminSetting && adminSetting.value) {
    admins = JSON.parse(adminSetting.value);
  }

  // 2. Find promoted admin
  const promotedAdmin = admins.find(
    a => !a.isDefault && (
      String(a.username || '').trim().toLowerCase().replace(/\s+/g, '') === cleanInputName ||
      String(a.name || '').trim().toLowerCase().replace(/\s+/g, '') === cleanInputName
    )
  );

  if (!promotedAdmin) {
    console.log('Result: FAILED (Username not found in admins list)');
    return { success: false, error: 'Invalid username' };
  }

  console.log(`Found promoted admin record: ${promotedAdmin.name} (Staff ID: ${promotedAdmin.staffId})`);

  // 3. Find staff member
  const staffMember = await prisma.staff.findUnique({
    where: { id: Number(promotedAdmin.staffId) }
  });

  if (!staffMember) {
    console.log('Result: FAILED (Staff member record not found)');
    return { success: false, error: 'Staff record not found' };
  }

  const hasCustomPass = !!staffMember.password;

  if (!hasCustomPass) {
    if (passwordInput === 'admin') {
      console.log('Result: SUCCESS (Needs New Password - default password matched!)');
      return { success: true, needsNewPassword: true, staffId: staffMember.id };
    } else {
      console.log('Result: FAILED (Invalid default password)');
      return { success: false, error: 'Invalid default password' };
    }
  }

  // 4. Validate custom password
  const hashedPassword = sha256(passwordInput);
  if (staffMember.password === passwordInput || staffMember.password === hashedPassword) {
    console.log('Result: SUCCESS (Login Successful - authenticated with custom password!)');
    return { success: true, needsNewPassword: false, staffId: staffMember.id };
  } else {
    console.log('Result: FAILED (Invalid password)');
    return { success: false, error: 'Invalid password' };
  }
}

async function simulateSetPassword(staffId, newPassword) {
  console.log(`\n--- Simulating Password Set for Staff ID ${staffId} ---`);
  const hashedPassword = sha256(newPassword);
  
  await prisma.staff.update({
    where: { id: Number(staffId) },
    data: { password: hashedPassword }
  });
  
  console.log('Result: SUCCESS (New password successfully hashed and stored!)');
}

async function main() {
  try {
    // Phase 1: Test default admin password flow
    const login1 = await simulateLogin('testadmin', 'wrongpassword');
    const login2 = await simulateLogin('testadmin', 'admin');
    
    if (login2.success && login2.needsNewPassword) {
      const staffId = login2.staffId;
      
      // Phase 2: Test password update
      await simulateSetPassword(staffId, 'securepassword123');
      
      // Phase 3: Test logins with custom password
      const login3 = await simulateLogin('testadmin', 'admin'); // Should fail now
      const login4 = await simulateLogin('testadmin', 'securepassword123'); // Should succeed
      
      // Phase 4: Clean up test admin's password and status
      console.log('\n--- Cleaning up test changes ---');
      await prisma.staff.update({
        where: { id: staffId },
        data: { password: null }
      });
      
      const adminSetting = await prisma.setting.findUnique({
        where: { key: 'admins_list' }
      });
      if (adminSetting) {
        let admins = JSON.parse(adminSetting.value);
        admins = admins.filter(a => a.username !== 'testadmin');
        await prisma.setting.update({
          where: { key: 'admins_list' },
          data: { value: JSON.stringify(admins) }
        });
      }
      console.log('Cleanup complete. System state is restored.');
    }
  } catch (error) {
    console.error('Error during validation flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
