import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const logs = await prisma.deliveryLog.findMany({
      include: {
        staff: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Fetch delivery logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staff_id, date_sent, whatsapp_status, email_status, payslip_data } = body;

    const existingLog = staff_id ? await prisma.deliveryLog.findFirst({
      where: {
        staff_id: Number(staff_id),
        date_sent,
      }
    }) : null;

    let log;

    if (existingLog) {
      log = await prisma.deliveryLog.update({
        where: { id: existingLog.id },
        data: {
          whatsapp_status,
          email_status,
          payslip_data,
        },
        include: {
          staff: true,
        },
      });
    } else {
      log = await prisma.deliveryLog.create({
        data: {
          staff_id: staff_id ? Number(staff_id) : null,
          date_sent,
          whatsapp_status,
          email_status,
          payslip_data,
        },
        include: {
          staff: true,
        },
      });
    }

    return NextResponse.json(log);
  } catch (error: any) {
    console.error('Create delivery log error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
