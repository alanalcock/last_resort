import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type DeliveryLogBatchItem = {
  id: string;
  staff_id: number;
  date_sent: string;
  whatsapp_status: string;
  email_status: string;
  payslip_data: unknown;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? (body.items as DeliveryLogBatchItem[]) : [];

    if (items.length === 0) {
      return NextResponse.json({ error: 'No delivery log items provided.' }, { status: 400 });
    }

    const saved = [];
    const failed = [];

    for (const item of items) {
      try {
        const existingLog = await prisma.deliveryLog.findFirst({
          where: {
            staff_id: Number(item.staff_id),
            date_sent: item.date_sent,
          },
        });

        const log = existingLog
          ? await prisma.deliveryLog.update({
              where: { id: existingLog.id },
              data: {
                whatsapp_status: item.whatsapp_status,
                email_status: item.email_status,
                payslip_data: item.payslip_data as any,
              },
              include: {
                staff: true,
              },
            })
          : await prisma.deliveryLog.create({
              data: {
                staff_id: Number(item.staff_id),
                date_sent: item.date_sent,
                whatsapp_status: item.whatsapp_status,
                email_status: item.email_status,
                payslip_data: item.payslip_data as any,
              },
              include: {
                staff: true,
              },
            });

        saved.push(log);
      } catch (error: any) {
        console.error('Batch delivery log item failed:', item?.id, error);
        failed.push({
          id: item?.id,
          staff_id: item?.staff_id ?? null,
          date_sent: item?.date_sent ?? null,
          error: error?.message || 'Failed to save delivery log item.',
        });
      }
    }

    return NextResponse.json({
      saved,
      failed,
      totals: {
        requested: items.length,
        saved: saved.length,
        failed: failed.length,
      },
    });
  } catch (error: any) {
    console.error('Batch delivery logs error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

