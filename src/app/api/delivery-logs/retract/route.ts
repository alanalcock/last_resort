import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dateSent = String(body?.date_sent || '').trim();

    if (!dateSent) {
      return NextResponse.json({ error: 'Missing pay date to retract.' }, { status: 400 });
    }

    const deleted = await prisma.deliveryLog.deleteMany({
      where: {
        date_sent: dateSent,
      },
    });

    return NextResponse.json({
      success: true,
      date_sent: dateSent,
      deleted_count: deleted.count,
    });
  } catch (error: any) {
    console.error('Retract delivery logs error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

