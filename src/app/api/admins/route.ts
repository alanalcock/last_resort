import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DEFAULT_ADMINS } from '@/lib/payroll/utils';

const prismaAdmin = () => (prisma as any).admin ?? null;

async function getLegacyAdmins() {
  const legacySetting = await prisma.setting.findUnique({
    where: { key: 'admins_list' },
  });

  if (!legacySetting?.value) {
    return DEFAULT_ADMINS;
  }

  try {
    const parsed = JSON.parse(legacySetting.value);
    return Array.isArray(parsed) ? parsed : DEFAULT_ADMINS;
  } catch (error) {
    console.error('Legacy admin parse error:', error);
    return DEFAULT_ADMINS;
  }
}

async function saveLegacyAdmins(admins: any[]) {
  await prisma.setting.upsert({
    where: { key: 'admins_list' },
    update: { value: JSON.stringify(admins) },
    create: { key: 'admins_list', value: JSON.stringify(admins) },
  });
}

export async function GET() {
  try {
    const adminDelegate = prismaAdmin();

    if (!adminDelegate) {
      return NextResponse.json(await getLegacyAdmins());
    }

    const admins = await adminDelegate.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json(admins);
  } catch (error: any) {
    console.error('Fetch admins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminDelegate = prismaAdmin();
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const role = String(body?.role || 'Administrator').trim();

    if (!name || !username) {
      return NextResponse.json({ error: 'Missing administrator name or username.' }, { status: 400 });
    }

    if (!adminDelegate) {
      const legacyAdmins = await getLegacyAdmins();
      if (legacyAdmins.some((admin: any) => String(admin.username || '').toLowerCase() === username)) {
        return NextResponse.json({ error: 'Administrator username already exists.' }, { status: 400 });
      }

      const created = {
        id: Date.now().toString(),
        name,
        username,
        password: undefined,
        role,
        isDefault: false,
      };
      const updatedAdmins = [...legacyAdmins, created];
      await saveLegacyAdmins(updatedAdmins);
      return NextResponse.json(created);
    }

    const created = await adminDelegate.create({
      data: {
        name,
        username,
        password: null,
        role,
        is_default: false,
      },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const adminDelegate = prismaAdmin();
    const body = await req.json();
    const id = Number(body?.id);
    const { id: _ignored, ...fields } = body;

    if (!Number.isFinite(id) && !body?.id) {
      return NextResponse.json({ error: 'Missing administrator id.' }, { status: 400 });
    }

    if (!adminDelegate) {
      const legacyAdmins = await getLegacyAdmins();
      const updatedAdmins = legacyAdmins.map((admin: any) =>
        String(admin.id) === String(body.id) ? { ...admin, ...fields } : admin,
      );
      await saveLegacyAdmins(updatedAdmins);
      const updated = updatedAdmins.find((admin: any) => String(admin.id) === String(body.id));
      return NextResponse.json(updated);
    }

    const updated = await adminDelegate.update({
      where: { id },
      data: fields,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update admin error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const adminDelegate = prismaAdmin();
    const body = await req.json();
    const id = Number(body?.id);

    if (!Number.isFinite(id) && !body?.id) {
      return NextResponse.json({ error: 'Missing administrator id.' }, { status: 400 });
    }

    if (!adminDelegate) {
      const legacyAdmins = await getLegacyAdmins();
      const existing = legacyAdmins.find((admin: any) => String(admin.id) === String(body.id));
      if (!existing) {
        return NextResponse.json({ error: 'Administrator not found.' }, { status: 404 });
      }
      if (existing.isDefault) {
        return NextResponse.json({ error: 'Cannot delete default admin.' }, { status: 400 });
      }
      await saveLegacyAdmins(legacyAdmins.filter((admin: any) => String(admin.id) !== String(body.id)));
      return NextResponse.json({ success: true });
    }

    const existing = await adminDelegate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Administrator not found.' }, { status: 404 });
    }

    if (existing.is_default) {
      return NextResponse.json({ error: 'Cannot delete default admin.' }, { status: 400 });
    }

    await adminDelegate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete admin error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
