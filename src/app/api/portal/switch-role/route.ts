import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { decrypt, createSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetRole = searchParams.get('role') || 'employee';
    const sessionCookie = (await cookies()).get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 1. SWITCH TO EMPLOYEE VIEW
    if (targetRole === 'employee') {
      let staffId: number | null = null;

      if (sessionCookie.startsWith('admin-session-')) {
        const staffIdStr = sessionCookie.replace('admin-session-', '');
        staffId = parseInt(staffIdStr, 10);
      } else {
        // Default admin or unrecognized admin session cannot switch to employee view
        return NextResponse.json({ error: 'System Owner cannot switch to employee view as they have no linked staff profile.' }, { status: 400 });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
      });

      if (!staff) {
        return NextResponse.json({ error: 'Linked staff profile not found.' }, { status: 404 });
      }

      // Convert admin session to standard employee session
      await createSession({
        staffId: staff.id,
        trn: staff.trn || '',
        employee_id: staff.employee_id || '',
        name: staff.name,
      });

      return NextResponse.json({ success: true });
    }

    // 2. SWITCH TO ADMIN VIEW
    if (targetRole === 'admin') {
      const decrypted = await decrypt(sessionCookie);

      if (!decrypted || !decrypted.staffId) {
        return NextResponse.json({ error: 'Invalid or expired employee session.' }, { status: 401 });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: decrypted.staffId },
      });

      if (!staff) {
        return NextResponse.json({ error: 'Staff profile not found.' }, { status: 404 });
      }

      // Check if this staff member has admin privileges in admins_list
      const adminSetting = await prisma.setting.findUnique({
        where: { key: 'admins_list' }
      });

      let admins = [];
      if (adminSetting) {
        try {
          admins = JSON.parse(adminSetting.value);
        } catch (e) {
          console.error('Error parsing admin settings:', e);
        }
      }

      const hasAdminPrivilege = admins.some(
        (a: any) => !a.isDefault && String(a.staffId) === String(staff.id)
      );

      if (!hasAdminPrivilege) {
        return NextResponse.json({ error: 'You do not have administrator privileges.' }, { status: 403 });
      }

      // Convert employee session back to admin session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      (await cookies()).set('session', `admin-session-${staff.id}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        sameSite: 'lax',
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid role specified.' }, { status: 400 });
  } catch (error: any) {
    console.error('Switch role error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
