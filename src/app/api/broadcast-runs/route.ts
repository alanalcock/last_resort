import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const runs = await prisma.broadcastRun.findMany({
      orderBy: { created_at: 'desc' },
    });
    return NextResponse.json(runs);
  } catch (error: any) {
    console.error('Fetch broadcast runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { filename, total_records, matched_records, sent_records } = await req.json();

    const run = await prisma.broadcastRun.create({
      data: {
        filename,
        total_records: total_records ? Number(total_records) : 0,
        matched_records: matched_records ? Number(matched_records) : 0,
        sent_records: sent_records ? Number(sent_records) : 0,
      },
    });

    return NextResponse.json(run);
  } catch (error: any) {
    console.error('Create broadcast run error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
