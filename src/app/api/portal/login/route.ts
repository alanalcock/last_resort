import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { ensureDefaultAdmin, hashPassword, verifyStoredPassword } from '@/lib/admins';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();



    const { action } = body;
    const adminDelegate = (prisma as any).admin ?? null;

    // 2. EMPLOYEE NAME & TRN VERIFICATION
    if (action === 'employee_verify') {
      const { name, trn } = body;
      const cleanInputName = String(name || '').trim().toLowerCase().replace(/\s+/g, '');
      const cleanInputTrn = String(trn || '').replace(/\D/g, '');

      if (!cleanInputName) {
        return NextResponse.json({ error: 'First & Last Name are required.' }, { status: 400 });
      }
      if (!cleanInputTrn) {
        return NextResponse.json({ error: 'TRN verification is required.' }, { status: 400 });
      }

      // Fetch all active staff
      const allStaff = await prisma.staff.findMany({
        where: {
          status: {
            notIn: ['Resigned', 'Terminated']
          }
        }
      });

      const staff = allStaff.find(s => {
        const dbName = String(s.name || '').trim().toLowerCase().replace(/\s+/g, '');
        const dbTrn = String(s.trn || '').replace(/\D/g, '');

        if (dbTrn !== cleanInputTrn) return false;

        // Exact match (space-stripped)
        if (dbName === cleanInputName) return true;

        // Fallback: If one contains the other
        return dbName.includes(cleanInputName) || cleanInputName.includes(dbName);
      });

      if (!staff) {
        return NextResponse.json({ 
          error: 'Verification failed. Please check that your name and TRN match our records.' 
        }, { status: 401 });
      }

      // Successful verification -> create session
      await createSession({
        staffId: staff.id,
        trn: staff.trn || '',
        employee_id: staff.employee_id || '',
        name: staff.name,
      });

      return NextResponse.json({ success: true, isAdmin: false });
    }

    // 2.5 ADMIN BYPASS
    if (action === 'admin_bypass') {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      (await cookies()).set('session', 'admin-session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });
      return NextResponse.json({ success: true, needsNewPassword: false, isAdmin: true });
    }

    // 3. ADMIN SECURE LOGIN - STEP 1 (VERIFY CREDENTIALS)
    if (action === 'admin_verify_step1') {
      const { username, password } = body;
      const cleanInputName = String(username || '').trim().toLowerCase().replace(/\s+/g, '');

      if (!cleanInputName || !password) {
        return NextResponse.json({ error: 'Administrator Username and password are required.' }, { status: 400 });
      }

      if (adminDelegate) {
        await ensureDefaultAdmin();
        const defaultAdminAlias = cleanInputName === 'defaultadmin' ? 'admin' : cleanInputName;
        const admin = await adminDelegate.findUnique({
          where: { username: defaultAdminAlias },
        });

        if (!admin) {
          return NextResponse.json({ error: 'Invalid administrator username.' }, { status: 401 });
        }

        const currentAdminPass = admin.password || 'admin';
        const isUsingDefaultPassword = currentAdminPass === 'admin';
        const isValidPassword = isUsingDefaultPassword
          ? password === 'admin'
          : await verifyStoredPassword(password, currentAdminPass);

        if (!isValidPassword) {
          return NextResponse.json({ error: 'Invalid administrator password. Please try again.' }, { status: 401 });
        }

        if (isUsingDefaultPassword) {
          return NextResponse.json({
            success: true,
            needsNewPassword: true,
            adminType: admin.is_default ? 'default' : 'promoted',
            username: admin.name,
            staffId: admin.id,
          });
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        (await cookies()).set('session', `admin-session-${admin.id}`, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          expires: expiresAt,
          sameSite: 'lax',
          path: '/',
        });

        return NextResponse.json({ success: true, needsNewPassword: false, isAdmin: true });
      }

      const adminSetting = await prisma.setting.findUnique({
        where: { key: 'admins_list' }
      });
      
      let admins: any[] = [
        { username: 'admin', password: 'admin', role: 'System Owner', name: 'Default Admin', isDefault: true }
      ];
      
      if (adminSetting) {
        try {
          admins = JSON.parse(adminSetting.value);
        } catch (e) {
          console.error('Error parsing admin settings:', e);
        }
      }

      // A. Check default admin
      const isDefaultAdminInput = cleanInputName === 'admin' || cleanInputName === 'defaultadmin';
      if (isDefaultAdminInput) {
        const defaultAdmin = admins.find(a => a.isDefault);
        const currentAdminPass = defaultAdmin ? defaultAdmin.password : 'admin';

        if (password === currentAdminPass) {
          if (currentAdminPass === 'admin') {
            // Needs to set a custom password
            return NextResponse.json({ 
              success: true, 
              needsNewPassword: true, 
              adminType: 'default', 
              username: 'Default Admin' 
            });
          } else {
            // Validated successfully
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            (await cookies()).set('session', 'admin-session', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              expires: expiresAt,
              sameSite: 'lax',
              path: '/',
            });
            return NextResponse.json({ success: true, needsNewPassword: false, isAdmin: true });
          }
        } else {
          return NextResponse.json({ error: 'Invalid admin password. Please try again.' }, { status: 401 });
        }
      }

      // B. Check promoted admins in settings
      const promotedAdmin = admins.find(
        a => !a.isDefault && (
          String(a.username || '').trim().toLowerCase().replace(/\s+/g, '') === cleanInputName ||
          String(a.name || '').trim().toLowerCase().replace(/\s+/g, '') === cleanInputName
        )
      );

      if (!promotedAdmin) {
        return NextResponse.json({ error: 'Invalid administrator username.' }, { status: 401 });
      }

      const staffMember = await prisma.staff.findUnique({
        where: { id: Number(promotedAdmin.staffId) }
      });

      if (!staffMember) {
        return NextResponse.json({ error: 'Administrator staff record not found.' }, { status: 404 });
      }

      // If they haven't chosen a custom password yet, they must use the default 'admin' password
      const hasCustomPass = !!staffMember.password;

      if (!hasCustomPass) {
        if (password === 'admin') {
          return NextResponse.json({ 
            success: true, 
            needsNewPassword: true, 
            adminType: 'promoted', 
            username: staffMember.name, 
            staffId: staffMember.id 
          });
        } else {
          return NextResponse.json({ error: 'Invalid default password. Use "admin" for initial login.' }, { status: 401 });
        }
      }

      const hashedPassword = await hashPassword(password);

      if (staffMember.password !== password && staffMember.password !== hashedPassword) {
        return NextResponse.json({ error: 'Invalid administrator password.' }, { status: 401 });
      }

      // Validated successfully
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      (await cookies()).set('session', `admin-session-${staffMember.id}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });

      return NextResponse.json({ success: true, needsNewPassword: false, isAdmin: true });
    }

    // 4. ADMIN SECURE LOGIN - STEP 2 (SET CUSTOM PASSWORD)
    if (action === 'admin_set_password') {
      const { username, newPassword, staffId } = body;
      const cleanInputName = String(username || '').trim().toLowerCase().replace(/\s+/g, ' ');

      if (!cleanInputName || !newPassword) {
        return NextResponse.json({ error: 'Username and new password are required.' }, { status: 400 });
      }

      if (adminDelegate) {
        const adminId = Number(staffId);
        if (!Number.isFinite(adminId)) {
          return NextResponse.json({ error: 'Administrator id is required.' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);
        await adminDelegate.update({
          where: { id: adminId },
          data: { password: hashedPassword },
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        (await cookies()).set('session', `admin-session-${adminId}`, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          expires: expiresAt,
          sameSite: 'lax',
          path: '/',
        });

        return NextResponse.json({ success: true });
      }

      const adminSetting = await prisma.setting.findUnique({
        where: { key: 'admins_list' }
      });
      
      let admins = [
        { username: 'admin', password: 'admin', role: 'System Owner', name: 'Default Admin', isDefault: true }
      ];
      
      if (adminSetting) {
        try {
          admins = JSON.parse(adminSetting.value);
        } catch (e) {
          console.error('Error parsing admin settings:', e);
        }
      }

      const isDefaultAdminInput = cleanInputName === 'admin' || cleanInputName === 'default admin';

      if (isDefaultAdminInput) {
        const updatedAdmins = admins.map(a => {
          if (a.isDefault) {
            return { ...a, password: newPassword };
          }
          return a;
        });

        await prisma.setting.upsert({
          where: { key: 'admins_list' },
          update: { value: JSON.stringify(updatedAdmins) },
          create: { key: 'admins_list', value: JSON.stringify(updatedAdmins) }
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        (await cookies()).set('session', 'admin-session', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          expires: expiresAt,
          sameSite: 'lax',
          path: '/',
        });

        return NextResponse.json({ success: true });
      }

      // Handle promoted admin password set
      if (!staffId) {
        return NextResponse.json({ error: 'Promoted admin staff ID is required.' }, { status: 400 });
      }

      const hashedPassword = await hashPassword(newPassword);

      await prisma.staff.update({
        where: { id: Number(staffId) },
        data: { password: hashedPassword }
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      (await cookies()).set('session', `admin-session-${staffId}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('API portal login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
