import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(staff);
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
