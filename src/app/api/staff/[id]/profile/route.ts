import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/session';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const staffId = Number(id);

    if (!Number.isFinite(staffId)) {
      return NextResponse.json({ error: 'Invalid staff profile.' }, { status: 400 });
    }

    const [staff, deliveryLogs] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: staffId },
      }),
      prisma.deliveryLog.findMany({
        where: { staff_id: staffId },
        include: { staff: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    if (!staff) {
      return NextResponse.json({ error: 'Staff profile not found.' }, { status: 404 });
    }

    return NextResponse.json({
      staff,
      deliveryLogs,
    });
  } catch (error: any) {
    console.error('Staff profile route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
