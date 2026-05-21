import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const [staff, settings, deliveryLogs] = await Promise.all([
      prisma.staff.findMany({ orderBy: { name: 'asc' } }),
      prisma.setting.findMany(),
      prisma.deliveryLog.findMany({
        include: { staff: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return NextResponse.json({
      user: session.user,
      staff,
      settings,
      deliveryLogs,
    });
  } catch (error: any) {
    console.error('Dashboard bootstrap error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

