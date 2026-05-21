import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = Number(searchParams.get('staffId'));
    const month = searchParams.get('month');

    if (!Number.isFinite(staffId)) {
      return NextResponse.json({ error: 'Missing or invalid staffId' }, { status: 400 });
    }

    const logs = await prisma.attendanceLog.findMany({
      where: {
        staff_id: staffId,
        ...(month
          ? {
              date: {
                startsWith: month,
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Fetch attendance logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staff_id, date, status, leave_type, present_type } = body;

    if (!Number.isFinite(Number(staff_id)) || !date) {
      return NextResponse.json({ error: 'staff_id and date are required' }, { status: 400 });
    }

    const normalizedStatus = String(status || '').trim();
    const normalizedLeaveType = String(leave_type || '').trim();
    const normalizedPresentType = String(present_type || '').trim();

    if (!normalizedStatus) {
      const deleted = await prisma.attendanceLog.deleteMany({
        where: {
          staff_id: Number(staff_id),
          date,
        },
      });

      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    const log = await prisma.attendanceLog.upsert({
      where: {
        staff_id_date: {
          staff_id: Number(staff_id),
          date,
        },
      },
      update: {
        status: normalizedStatus,
        present_type: normalizedStatus === 'Present' ? normalizedPresentType || null : null,
        leave_type: normalizedStatus === 'Leave' ? normalizedLeaveType || null : null,
      },
      create: {
        staff_id: Number(staff_id),
        date,
        status: normalizedStatus,
        present_type: normalizedStatus === 'Present' ? normalizedPresentType || null : null,
        leave_type: normalizedStatus === 'Leave' ? normalizedLeaveType || null : null,
      },
    });

    return NextResponse.json(log);
  } catch (error: any) {
    console.error('Save attendance log error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
