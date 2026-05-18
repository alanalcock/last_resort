import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await verifySession();

    if (!session || !session.staffId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.deliveryLog.findMany({
      where: { staff_id: session.staffId },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Fetch portal payslips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
