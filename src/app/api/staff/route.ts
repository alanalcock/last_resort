import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const [staff, adminSetting] = await Promise.all([
      prisma.staff.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.setting.findUnique({
        where: { key: 'admins_list' },
      }),
    ]);

    let hiddenAdminIds = new Set<number>();

    if (adminSetting?.value) {
      try {
        const admins = JSON.parse(adminSetting.value);
        if (Array.isArray(admins)) {
          hiddenAdminIds = new Set(
            admins
              .filter((admin: any) => !admin?.isDefault && admin?.staffId)
              .map((admin: any) => Number(admin.staffId))
              .filter((id: number) => Number.isFinite(id)),
          );
        }
      } catch (error) {
        console.error('Parse admins_list during staff fetch error:', error);
      }
    }

    return NextResponse.json(staff.filter((person) => !hiddenAdminIds.has(person.id)));
  } catch (error: any) {
    console.error('Fetch staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { id, ...fields } = data;

    if (id) {
      const updated = await prisma.staff.update({
        where: { id: Number(id) },
        data: fields,
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.staff.create({
        data: fields,
      });
      return NextResponse.json(created);
    }
  } catch (error: any) {
    console.error('Create/update staff error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json();
    const { id, ...fields } = data;

    if (!id) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const updated = await prisma.staff.update({
      where: { id: Number(id) },
      data: fields,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Patch staff error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const data = await req.json();
    const staffId = Number(data?.id);

    if (!Number.isFinite(staffId)) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.attendanceLog.deleteMany({
        where: { staff_id: staffId },
      }),
      prisma.payslip.deleteMany({
        where: { staff_id: staffId },
      }),
      prisma.deliveryLog.deleteMany({
        where: { staff_id: staffId },
      }),
      prisma.staff.delete({
        where: { id: staffId },
      }),
    ]);

    return NextResponse.json({ success: true, id: staffId });
  } catch (error: any) {
    console.error('Delete staff error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
